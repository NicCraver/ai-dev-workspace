# 生成自己发 ActionCard 的均匀光晕 9 图（对齐 PC token `0 0 4px rgba(31,35,41,.1)`）
# 输出 xxhdpi（3x）：4dp 光晕 = 12px，16dp 圆角 = 48px，CSS blur 4px = sigma 2dp = 6px
from PIL import Image, ImageDraw, ImageFilter

SCALE = 3            # xxhdpi
SS = 4               # 超采样倍数，画完再缩回来，边缘不锯齿
INSET = 4 * SCALE    # 12px 光晕留空
RADIUS = 16 * SCALE  # 卡片圆角
SIGMA = 2 * SCALE    # CSS blur 4px ≈ sigma 2px
ALPHA = 0.10         # rgba(31,35,41,.1)
RGB = (31, 35, 41)
CONTENT = 126        # 内容区边长：12 + 48 + 6 + 48 + 12
CARD = (INSET, INSET, CONTENT - INSET - 1, CONTENT - INSET - 1)


def rounded(draw, box, radius, scale=1):
    b = [v * scale for v in box]
    # 卡片右上角是直角（对齐 shape_solid_f0f5ff_lefttop_leftbottom_rightbottom_radius_16dp）
    draw.rounded_rectangle(b, radius=radius * scale, fill=255,
                           corners=(True, False, True, True))


# 1. 超采样画出卡片轮廓
big = Image.new("L", (CONTENT * SS, CONTENT * SS), 0)
rounded(ImageDraw.Draw(big), CARD, RADIUS, SS)
mask = big.resize((CONTENT, CONTENT), Image.LANCZOS)

# 2. 模糊成光晕，再压到 10% 透明度
glow = mask.filter(ImageFilter.GaussianBlur(SIGMA)).point(lambda v: int(v * ALPHA))

# 3. 卡体范围掏空：上层不透明卡片会盖住这里，留着只会让卡体发灰
hole = Image.new("L", (CONTENT * SS, CONTENT * SS), 0)
rounded(ImageDraw.Draw(hole), (CARD[0] + 1, CARD[1] + 1, CARD[2] - 1, CARD[3] - 1), RADIUS - 1, SS)
hole = hole.resize((CONTENT, CONTENT), Image.LANCZOS)
glow = Image.composite(Image.new("L", glow.size, 0), glow, hole)

content = Image.merge("RGBA", (
    Image.new("L", glow.size, RGB[0]),
    Image.new("L", glow.size, RGB[1]),
    Image.new("L", glow.size, RGB[2]),
    glow,
))

# 4. 套 9 图边框：上/左标拉伸区（取直边段），右/下标内容区（= 4dp padding）
out = Image.new("RGBA", (CONTENT + 2, CONTENT + 2), (0, 0, 0, 0))
out.paste(content, (1, 1))
px = out.load()
BLACK = (0, 0, 0, 255)
stretch = range(INSET + RADIUS + 1, INSET + RADIUS + 5)   # 61..64，落在直边上
for i in stretch:
    px[i + 1, 0] = BLACK
    px[0, i + 1] = BLACK
for i in range(INSET, CONTENT - INSET):
    px[i + 1, CONTENT + 1] = BLACK
    px[CONTENT + 1, i + 1] = BLACK

out.save("/Users/nic/w/ai-dev-workspace/apps/android/base_util/src/main/res/drawable-xxhdpi/zu_zhi_robot_card_own_send_glow.9.png")
print("ok", out.size)
