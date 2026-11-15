// Layout applies at delivery so existing private uploads keep their cards and behavior.
export function talksSidebar(html){
 if(!/id=["']menu["']/.test(html)||!/id=["']menuButton["']/.test(html))return html;
 const style=`<style id="maven-talks-sidebar-layout">
#menuButton{display:none!important}
#menu.menu,#menu.menu.hidden{display:block!important;position:fixed;inset:92px auto 0 0;width:230px;overflow-y:auto;background:#e8edf2;border:0;border-right:1px solid #183c6526;border-radius:0;box-shadow:none;padding:26px 16px;z-index:4}
#menu::before{content:'YOUR CARDS';display:block;margin:0 12px 22px;color:#183c65;font:700 11px Arial,sans-serif;letter-spacing:2px}
#menu button{display:block;width:100%;min-height:48px;margin:0 0 10px;padding:13px 14px;white-space:normal;text-align:left;background:transparent;border:1px solid transparent;border-radius:8px;color:#183c65;line-height:1.4}
#menu .maven-dashboard-link{display:block;padding:13px 10px;margin:0 0 20px;border:1px solid #183c6544;border-radius:8px;color:#183c65;background:#fff;text-decoration:none;font:600 14px/1.4 Arial,sans-serif;min-height:44px;overflow-wrap:anywhere}#menu .maven-dashboard-link:hover{background:#fdfbf5}#menu .maven-dashboard-link:focus-visible{outline:3px solid #b79a68;outline-offset:3px}
#menu button:hover{background:#fff}
#menu button.active,#menu button[aria-current="page"]{background:#183c65;color:#fff;border-color:#183c65}
body>main{width:calc(100% - 230px);max-width:none;margin:0 0 0 230px;padding:26px 32px;min-width:0}
body>header{position:relative;z-index:5}
.stage.both{flex-wrap:wrap}.stage .face-wrap{min-width:0}main footer{flex-wrap:wrap}
@media(max-width:1000px){#menu.menu,#menu.menu.hidden{width:200px;padding:22px 12px}body>main{width:calc(100% - 200px);margin-left:200px;padding:24px}.stage.both{gap:18px}.stage.both .face-wrap{width:calc(50% - 9px)}.stage.both .question{font-size:26px}.stage.both .card-face{padding:18px}}
@media(max-width:700px){#menu.menu,#menu.menu.hidden{top:80px;width:150px;padding:20px 9px}#menu::before{font-size:10px;margin:0 8px 18px;letter-spacing:1px}#menu button{padding:12px 9px;font-size:13px}body>main{width:calc(100% - 150px);margin-left:150px;padding:20px 14px}.stage.both .face-wrap{width:100%}.stage.both .question{font-size:29px}}
@media(max-width:440px){#menu.menu,#menu.menu.hidden{width:124px;padding:16px 6px}#menu button{font-size:12px;padding:12px 7px}body>main{width:calc(100% - 124px);margin-left:124px;padding:18px 10px}.viewhead h1{font-size:23px}.stage .question,.stage.both .question{font-size:24px}.card-face{padding:16px}.controls .actions>button{width:100%}.choices{grid-template-columns:1fr}.panel{padding:14px}.card-top{padding:12px 10px;gap:6px}.card-top .tag{font-size:10px}.card-top .cat{font-size:11px}.table-tools input{width:100%}}
</style>`;
 const script=`<script id="maven-talks-sidebar-state">(()=>{const menu=document.getElementById('menu');menu.setAttribute('aria-label','MAVEN Talks navigation');const buttons=Array.from(menu.querySelectorAll('button[data-mode]'));function mark(mode){for(const b of buttons){const active=b.dataset.mode===mode;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}}mark('random');menu.addEventListener('click',event=>{const button=event.target.closest('button[data-mode]');if(button&&menu.contains(button))mark(button.dataset.mode);});})();</script>`;
 return html.replace(/(<nav\b[^>]*\bid=["']menu["'][^>]*>)/i,'$1<a id="maven-dashboard-link" class="maven-dashboard-link" href="/account">← Back to dashboard</a>').replace(/<\/head>/i,style+'</head>').replace(/<\/body>/i,script+'</body>');
}
