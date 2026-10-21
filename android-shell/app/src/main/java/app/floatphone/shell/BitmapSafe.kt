package app.floatphone.shell

import android.graphics.Bitmap
import android.graphics.BitmapFactory

/**
 * 位图解码的「限尺寸」工具。
 *
 * 为什么必须有它（改之前先读）：
 *   通知大图标（角色头像）在壳里有两条来路——网页内联的 `data:image/...;base64`
 *   和 http(s) 直链。两者都可能是**原图**：几百 KB 的 JPEG 解码成
 *   ARGB_8888 位图就是十几 MB，2MB 的 PNG 能到三四十 MB。
 *   以前两处（MainActivity / PushService）都是
 *   `BitmapFactory.decodeByteArray(bytes, 0, bytes.size)` 全尺寸解码，
 *   而通知只需要几十像素的大图标。每来一条带头像的消息就白扔几十 MB，
 *   用不了几分钟堆内存就见底，系统随后杀掉 WebView 渲染进程，
 *   表现就是实测反馈的「用不到五分钟突然卡顿、接着闪退」。
 *
 * 做法与通知图标的实际需求对齐：
 *   · 先 only-bounds 扫一遍拿到原始宽高，再按 2 的幂降采样，
 *     让短边不超过 [MAX_AVATAR_DIMEN]（256px 已足够任何通知栏显示）；
 *   · 解码只走一次磁盘/网络数据，不进 Bitmap 之前就把尺寸压下来。
 *
 * 所有方法都返回 null 而不抛异常：头像只是锦上添花，绝不能让一张图
 * 拖住通知，更不能因为它让进程 OOM。
 */
object BitmapSafe {

    /** 通知大图标的目标上限（长边像素）。再大也看不出来，只是白占内存。 */
    const val MAX_AVATAR_DIMEN = 256

    /**
     * 按 [maxDimen] 降采样解码。
     *
     * @return 解码失败、数据为空或只有一块空白时返回 null（调用方退回应用图标）。
     */
    fun decodeSampled(bytes: ByteArray, maxDimen: Int = MAX_AVATAR_DIMEN): Bitmap? = runCatching {
        if (bytes.isEmpty()) return@runCatching null

        // 第一次只量尺寸，不分配像素内存。
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        val rawWidth = bounds.outWidth
        val rawHeight = bounds.outHeight
        if (rawWidth <= 0 || rawHeight <= 0) return@runCatching null

        val limit = maxDimen.coerceAtLeast(1)
        var sample = 1
        // 每次翻倍直到长边落进上限内。BitmapFactory 要求 inSampleSize 为 2 的幂
        // （非 2 的幂会被向下取到最近的 2 的幂），所以这里直接按 2 的幂算，
        // 免得「以为设了 3、实际取了 2」这种隐式差异。
        while (rawWidth / sample > limit || rawHeight / sample > limit) {
            sample *= 2
        }

        val options = BitmapFactory.Options().apply {
            inSampleSize = sample
            // 通知图标不需要 8888 的精度；RGB_565 在同样尺寸下再省一半内存。
            // （带透明通道的头像边缘在深色通知栏上可能有轻微描边，可接受。）
            inPreferredConfig = Bitmap.Config.RGB_565
        }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    }.getOrNull()
}
