# -*- coding: utf-8 -*-
"""Charts for the СканРецепт architecture report (Russian, DejaVu Sans).
Palette: Crystal Blue body subset (Template 07): accent #2d7ab3, header #1a4a7a,
border #c0d0e2, text #142840, muted #5a7a96, stripe #eef3fa.
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

ACCENT   = '#2d7ab3'
HEADER   = '#1a4a7a'
LIGHT    = '#a8c8e0'
TEXT     = '#142840'
MUTED    = '#5a7a96'
BORDER   = '#c0d0e2'

OUT = '/home/z/my-project/scripts/pdf_build'


def style_ax(ax):
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_visible(False)
    ax.spines['bottom'].set_color(BORDER)
    ax.tick_params(colors=MUTED, labelcolor=TEXT)


# ── Chart 1: severity donut ─────────────────────────────────────────
fig, ax = plt.subplots(figsize=(7.0, 3.9), constrained_layout=True)
vals = [4, 10, 14]
labels = ['Критичные — 4', 'Важные — 10', 'Полировка — 14']
cols = [HEADER, ACCENT, LIGHT]
wedges, _ = ax.pie(
    vals, colors=cols, startangle=90, counterclock=False,
    wedgeprops=dict(width=0.35, edgecolor='white', linewidth=2),
)
ax.text(0, 0.08, '28', ha='center', va='center', fontsize=30,
        fontweight='bold', color=TEXT)
ax.text(0, -0.26, 'находок', ha='center', va='center', fontsize=11, color=MUTED)
ax.legend(wedges, labels, loc='center left', bbox_to_anchor=(1.02, 0.5),
          frameon=False, fontsize=12, handlelength=1.0, handleheight=1.0,
          labelspacing=1.1)
ax.set_aspect('equal')
fig.savefig(f'{OUT}/chart_severity.png', dpi=200, facecolor='white')
plt.close(fig)

# ── Chart 2: bundle size before/after ───────────────────────────────
fig, ax = plt.subplots(figsize=(7.0, 2.9), constrained_layout=True)
cats = ['Сейчас\n(монолит)', 'После ленивой\nзагрузки zxing']
vals2 = [1.84, 1.35]
bars = ax.barh(cats, vals2, height=0.52, color=[ACCENT, HEADER], edgecolor='none')
for b, v in zip(bars, vals2):
    ax.text(v + 0.03, b.get_y() + b.get_height() / 2,
            f'{str(v).replace(".", ",")} МБ', va='center', ha='left',
            fontsize=12, fontweight='bold', color=TEXT)
ax.text(0.985, 0.06, 'в сжатом виде (gzip): 367 КБ → 241 КБ',
        transform=ax.transAxes, ha='right', va='bottom',
        fontsize=10, color=MUTED, style='italic')
ax.set_xlim(0, 2.35)
ax.invert_yaxis()
ax.set_xlabel('размер стартового скрипта сайта, МБ', fontsize=10, color=MUTED)
ax.grid(axis='x', linestyle='--', linewidth=0.5, alpha=0.2, color=MUTED)
ax.set_axisbelow(True)
ax.tick_params(axis='y', labelsize=11)
style_ax(ax)
fig.savefig(f'{OUT}/chart_bundle.png', dpi=200, facecolor='white')
plt.close(fig)

# ── Chart 3: catalog composition ────────────────────────────────────
fig, ax = plt.subplots(figsize=(7.0, 3.1), constrained_layout=True)
cats3 = ['Блюд в исходниках', 'С фото в каталоге', 'ЛАЙТ (бесплатно)', 'PRO (по подписке)']
vals3 = [399, 260, 161, 99]
cols3 = [HEADER, ACCENT, LIGHT, LIGHT]
bars = ax.barh(cats3, vals3, height=0.55, color=cols3, edgecolor='none')
for b, v in zip(bars, vals3):
    ax.text(v + 6, b.get_y() + b.get_height() / 2, str(v),
            va='center', ha='left', fontsize=12, fontweight='bold', color=TEXT)
ax.set_xlim(0, 460)
ax.invert_yaxis()
ax.set_xlabel('количество блюд', fontsize=10, color=MUTED)
ax.grid(axis='x', linestyle='--', linewidth=0.5, alpha=0.2, color=MUTED)
ax.set_axisbelow(True)
ax.tick_params(axis='y', labelsize=11)
style_ax(ax)
fig.savefig(f'{OUT}/chart_catalog.png', dpi=200, facecolor='white')
plt.close(fig)

print('charts done')
