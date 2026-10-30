#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Воронка продаж СканРецепт (illustrative widths, benchmark labels).
Данные: типичные ориентиры категории (RevenueCat State of Subscription Apps 2025,
Business of Apps CPI 2025). Ширина полос условная — для читаемости.
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon

plt.rcParams.update({
    'font.sans-serif': ['DejaVu Sans'],
    'axes.unicode_minus': False,
    'figure.facecolor': '#FFFFFF',
    'savefig.facecolor': '#FFFFFF',
})

# (название, подпись-метрика, ширина 0..1, цвет)
STAGES = [
    ('Охват: увидели контент/ссылку', 'SEO-статьи, соцсети, сарафан', 1.00, '#1E3A8A'),
    ('Открыли лендинг / страницу установки', 'конверсия клика 3–8%', 0.82, '#25479B'),
    ('Установили PWA (первый запуск)', '25–40% от открывших лендинг', 0.66, '#2F5AAC'),
    ('Активация: первый скан или подбор', '40–55% от установок', 0.50, '#3E6FC1'),
    ('Удержание: 2+ сессии на 2-й неделе', '20–30% от активированных', 0.37, '#5E8CD4'),
    ('Триггер ценности: лимит Лайта исчерпан', '5 сканов/день в Лайте', 0.26, '#82A9E2'),
    ('PRO-подписка', '1–3% активной аудитории', 0.16, '#C6866A'),
    ('Рекомендация: поделились рецептом', '8–12% активных за месяц', 0.22, '#64748B'),
]

N = len(STAGES)
fig, ax = plt.subplots(figsize=(13, 7.6), constrained_layout=True)
ax.set_xlim(-0.62, 0.62)
ax.set_ylim(-0.05, N + 0.55)
ax.axis('off')

band_h = 0.74
for i, (name, metric, w, color) in enumerate(STAGES):
    y = N - 1 - i
    y0 = y - band_h / 2
    y1 = y + band_h / 2
    w_next = STAGES[i + 1][2] if i + 1 < N else w * 0.82
    # трапеция: от текущей ширины к следующей
    poly = Polygon([(-w / 2, y0), (w / 2, y0), (w_next / 2, y1), (-w_next / 2, y1)],
                   closed=True, facecolor=color, edgecolor='white', linewidth=2.5, zorder=3)
    ax.add_patch(poly)
    txt_color = 'white'
    ax.text(0, y - 0.06, name, ha='center', va='center', fontsize=11.5,
            fontweight='bold', color=txt_color, zorder=4)
    ax.text(0, y - 0.26, metric, ha='center', va='center', fontsize=8.6,
            color='#DCE6F5' if i < 6 else '#F3E3D8', zorder=4)

ax.set_title('Воронка СканРецепт: от охвата до PRO-подписки',
             loc='left', fontsize=17, fontweight='bold', color='#1F2937', pad=18)
ax.text(-0.62, N + 0.28,
        'Конверсии между ступенями — типичные ориентиры категории (RevenueCat 2025, Business of Apps 2025); '
        'ширина полос условная',
        fontsize=9, color='#6B7280', va='center')

out = '/home/z/my-project/download/analytics/funnel.png'
import os
os.makedirs(os.path.dirname(out), exist_ok=True)
fig.savefig(out, dpi=220, facecolor='white', bbox_inches='tight', pad_inches=0.25)
plt.close(fig)
print('OK', out)
