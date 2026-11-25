#!/usr/bin/env python3
# Генератор офлайн-копирки промптов: download/scanrecipe-prompts.html
# Источник: download/gemini-full-queue-prompts.txt (формат "N. slug (текущий балл аудита: X)\nPROMPT")
# Требование пользователя 2026-11-12: удобный инструмент копипаста промптов вне чата.
import re, json, html, datetime, os

ROOT = '/home/z/my-project'
SRC = f'{ROOT}/download/gemini-full-queue-prompts.txt'
OUT = f'{ROOT}/download/scanrecipe-prompts.html'

text = open(SRC, encoding='utf-8').read()
head_re = re.compile(r'^(\d+)\.\s+(\S+)\s+\(текущий балл аудита:\s*([^)]+)\)\s*$', re.M)
matches = list(head_re.finditer(text))
cards = []
for i, m in enumerate(matches):
    n, slug, score = m.group(1), m.group(2), m.group(3).strip()
    start = m.end()
    end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
    prompt = text[start:end].strip()
    if prompt:
        cards.append({'n': int(n), 'slug': slug, 'score': score, 'prompt': prompt})

data = json.dumps(cards, ensure_ascii=False)
date_str = datetime.date.today().isoformat()

page = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>СканРецепт — копирка промптов</title>
<style>
:root{--bg:#f6f4ef;--card:#ffffff;--ink:#2b2a26;--muted:#8a8577;--line:#e5e1d6;
--accent:#2e7d52;--accent2:#b3541e;--chip:#efece3}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink)}
header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 18px 10px}
h1{margin:0 0 2px;font-size:19px}
.sub{color:var(--muted);font-size:13px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
input#q{flex:1;min-width:180px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff}
button{padding:9px 14px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:13px;cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
button.primary:hover{filter:brightness(1.08)}
button:hover{border-color:#c9c4b5}
button.on{background:var(--chip);font-weight:600}
main{max-width:880px;margin:0 auto;padding:16px 18px 80px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:14px 0;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.top{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.num{color:var(--muted);font-size:12px;min-width:26px}
.slug{font-weight:700;font-size:15px;font-family:ui-monospace,Consolas,monospace}
.badge{font-size:11px;padding:3px 8px;border-radius:999px;background:var(--chip);color:var(--muted);white-space:nowrap}
.badge.low{background:#fbe4e0;color:#a33a2c}
.badge.mid{background:#fbf0d9;color:#94690e}
pre{margin:10px 0 0;padding:12px;border-radius:10px;background:#fbfaf6;border:1px solid var(--line);
font:12.5px/1.55 ui-monospace,Consolas,monospace;white-space:pre-wrap;word-break:break-word;color:#3d3a33}
.actions{display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap}
label.done{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--muted);cursor:pointer;user-select:none}
.copy-ok{color:var(--accent);font-size:13px;display:none}
.card.isdone{opacity:.55;border-style:dashed}
.card.isdone pre{display:none}
.card.isdone .expand{display:inline-block}
.expand{display:none;font-size:12px;color:var(--muted);cursor:pointer;text-decoration:underline}
.hint{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin:14px 0;font-size:13.5px;line-height:1.55}
.hint b{color:var(--accent2)}
.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--ink);color:#fff;
padding:10px 18px;border-radius:12px;font-size:14px;opacity:0;transition:.25s;pointer-events:none;z-index:9}
.toast.show{opacity:.95}
.count{font-size:13px;color:var(--muted);margin-top:8px}
</style>
</head>
<body>
<header>
<h1>СканРецепт — копирка промптов для Gemini</h1>
<div class="sub">Обновлено __DATE__ · стиль v7 · очередь брака, худшие сверху. Промпты на английском — так нейрогенератор даёт более честное «домашнее» фото.</div>
<div class="toolbar">
<input id="q" type="search" placeholder="Поиск блюда, например: wonton">
<button id="hide">Скрыть готовые</button>
<button id="reset">Сбросить отметки</button>
<button id="copyall">Копировать все видимые</button>
<button id="save" class="primary">Скачать .txt</button>
</div>
<div class="count" id="count"></div>
</header>
<main>
<div class="hint">
<b>Как работать:</b> 1) включите VPN и откройте Gemini (режим генерации изображений) ·
2) нажмите «Скопировать» у нужного блюда и вставьте в Gemini ·
3) формат — ландшафт <b>3:2 или 4:3</b> (не квадрат) ·
4) готовый фото скачайте и отправьте в чат мне пачкой по 10–15 шт (имя файла — slug блюда, например wonton-soup.jpg) ·
5) после отправки отметьте карточку «Готово» — отметки сохраняются в браузере.
</div>
<div id="list"></div>
</main>
<div class="toast" id="toast">Скопировано</div>
<script>
const CARDS = __DATA__;
const KEY='scanrecipe-done-v1';
let done=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'));
let hide=false;
const list=document.getElementById('list');
const esc=s=>s;
function badge(score){const v=parseFloat(score);let cls='';if(!isNaN(v)){if(v<6)cls='low';else if(v<8)cls='mid';}
return '<span class="badge '+cls+'">балл аудита: '+score+'</span>';}
function cardHTML(c,i){
const isdone=done.has(c.slug);
return '<div class="card'+(isdone?' isdone':'')+'" data-slug="'+c.slug+'">'
+'<div class="top"><span class="num">#'+c.n+'</span><span class="slug">'+c.slug+'</span>'+badge(c.score)
+'<span class="expand">показать промпт</span></div>'
+'<pre>'+esc(c.prompt)+'</pre>'
+'<div class="actions"><button class="primary copy">Скопировать</button>'
+'<label class="done"><input type="checkbox" class="chk"'+(isdone?' checked':'')+'> Готово</label>'
+'<span class="copy-ok">Скопировано ✓</span></div></div>';
}
function render(){
const q=document.getElementById('q').value.trim().toLowerCase();
list.innerHTML=CARDS.filter(c=>!q||c.slug.includes(q)||c.prompt.toLowerCase().includes(q))
.map(cardHTML).join('')||'<div class="hint">Ничего не найдено.</div>';
updateCount();
}
function updateCount(){
const vis=list.querySelectorAll('.card').length;
document.getElementById('count').textContent='Карточек всего: '+CARDS.length+' · выполнено: '+done.size+(hide?' · показаны неготовые':'');
}
list.addEventListener('click',e=>{
const card=e.target.closest('.card');if(!card)return;
const slug=card.dataset.slug;
const pre=card.querySelector('pre');
if(e.target.classList.contains('copy')){
copy(pre.textContent);flash(card.querySelector('.copy-ok'));
}else if(e.target.classList.contains('chk')){
if(e.target.checked){done.add(slug)}else{done.delete(slug)}
localStorage.setItem(KEY,JSON.stringify([...done]));
card.classList.toggle('isdone',e.target.checked);
if(hide&&!e.target.checked){}else{setTimeout(render,0)}
updateCount();
}else if(e.target.classList.contains('expand')){
pre.style.display='block';e.target.style.display='none';
}
});
document.getElementById('q').addEventListener('input',render);
document.getElementById('hide').addEventListener('click',function(){
hide=!hide;this.classList.toggle('on',hide);render();
document.querySelectorAll('.card.isdone').forEach(c=>c.style.display=hide?'none':'');
});
document.getElementById('reset').addEventListener('click',()=>{
if(!confirm('Сбросить все отметки «Готово»?'))return;
done.clear();localStorage.setItem(KEY,'[]');render();
});
document.getElementById('copyall').addEventListener('click',()=>{
const txt=[...list.querySelectorAll('.card')].map(c=>c.querySelector('pre').textContent).join('\\n\\n');
copy(txt);document.getElementById('toast').textContent='Скопировано: '+list.querySelectorAll('.card').length+' промптов';
flash(document.getElementById('toast'));document.getElementById('toast').textContent='Скопировано';
});
document.getElementById('save').addEventListener('click',()=>{
const txt=CARDS.map(c=>'#'+c.n+' '+c.slug+' (балл '+c.score+')\\n\\n'+c.prompt).join('\\n\\n----\\n\\n');
const a=document.createElement('a');
a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));
a.download='scanrecipe-prompts.txt';a.click();
});
function copy(t){
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).catch(()=>fallback(t));}
else fallback(t);
}
function fallback(t){
const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);
ta.select();try{document.execCommand('copy')}catch(e){}document.body.removeChild(ta);
}
function flash(el){el.style.display='inline';setTimeout(()=>el.style.display='none',1600);
const t=document.getElementById('toast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1200);}
render();
</script>
</body>
</html>
"""

page = page.replace('__DATA__', data).replace('__DATE__', date_str)
open(OUT, 'w', encoding='utf-8').write(page)
print(f'Карточек: {len(cards)} -> {OUT} ({os.path.getsize(OUT)} байт)')
if cards:
    print('Первая:', cards[0]['slug'], ' Последняя:', cards[-1]['slug'])
