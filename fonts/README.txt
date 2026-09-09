字体：文渊黑体 / WenYuan Sans SC
来源：猫啃网 https://www.maoken.com/freefonts/28291.html
授权：SIL Open Font License 1.1 —— 可免费商用、可嵌入网页
      https://openfontlicense.org/open-font-license-official-text/

本目录的 woff2 是网页用子集，由 fonttools pyftsubset 生成：
  - 字符集：GB2312 一级常用字 3755 + 本站在用字符 + ASCII + 常用标点（共 3898 字）
  - 已去 hinting、brotli 压缩
  - 体积：Regular 541KB / Bold 554KB（原字体每字重约 11MB）

重新生成（改了大量文字之后）：
  uv run --isolated --with fonttools --with brotli python subset_wenyuan.py
