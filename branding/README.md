# 工大学伴图标 · 0.4.0

以用户手机桌面截图为风格参考：白底、明显留白、简洁彩色主体。蓝青色的打开书页同时围出门廊，呼应图书馆和空教室。

- `icon-master.png`：imagegen 内置工具生成的透明原始图；不是学校官方标识。
- `app-icon-1024.png`：圆角白底展示/通用图标。
- `icon-preview.png`：不同裁切和小尺寸的预览，非手机实拍。
- `../android/res/`：Android 7 兼容图标、Android 8 自适应前景/背景、Android 13 单色主题图层。
- `../windows/campus.ico`：Windows 多尺寸图标。

`tools/export-icons.py` 只做尺寸、留白、图层、颜色蒙版与文件格式导出，不修改图案设计。重新导出后再运行两个构建脚本。

生成方式：内置 imagegen。两次提示如下。

## 初稿提示

Use case: logo-brand. Asset: the central foreground mark for the Android adaptive launcher icon of 工大学伴, a personal university classroom and library seat helper. Create one polished original app symbol. A compact, bold open-book silhouette whose two upright folded pages also suggest a welcoming campus doorway in the central negative space. The book/door is ONE integrated geometric symbol, not a collection of separate objects. Cobalt blue left page, clear cyan-to-turquoise right page, minimal tasteful flat gradient like a refined contemporary mobile app logo. Large simple continuous shapes, softly rounded corners, precise balanced curves, strong legibility at 48 pixels. Flat vector-like graphic appearance, facing straight forward, no perspective. Friendly, calm, competent. Centre the entire symbol on a square transparent canvas with generous clear margins; symbol about 65% of image width. True transparent background; no tile or outer container (the Android launcher will supply a white tile). No text, no letters, no border, no school seal, no badges, no tiny details, no page lines, no ground shadow, no photographic texture, no mockup, no 3D object. Produce a finished high quality transparent PNG asset, only one symbol.

## 最终细化提示

Refine this app logo into a finished production launcher foreground. Keep the recognizable open-book / central doorway idea and the blue-left / cyan-right color identity. Simplify the construction into TWO bold curved page shapes only: remove the separate thin curved strips under the pages, and let each main page extend down naturally to a simple shallow book V. Keep an unmistakable rounded doorway-shaped negative space between the pages. Smooth precise vector-like contours with absolutely clean alpha edges, no stray pixels or speckle anywhere. Flatter more minimal, just a subtle smooth cobalt-to-sky gradient on the left and cyan-to-teal on the right. Strong graphic silhouette at tiny sizes. No detail lines or texture, no dots, no letters, no text, no badge, no border, no shadows. True transparent background. One centered symbol occupying about 65% width on a square canvas with generous margin. This will sit on a white rounded-square Android launcher tile.

