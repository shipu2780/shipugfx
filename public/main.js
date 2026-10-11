(function(){
var btn=document.getElementById('menuBtn'),nav=document.getElementById('navlinks');
function setMenu(open){nav.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'\u00d7':'\u2630'}
if(btn&&nav){btn.addEventListener('click',function(){setMenu(!nav.classList.contains('open'))});
nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){setMenu(false)})});
document.addEventListener('keydown',function(e){if(e.key==='Escape')setMenu(false)})}
var y=document.getElementById('year');if(y)y.textContent=new Date().getFullYear();
var els=document.querySelectorAll('.reveal');
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}})},{threshold:.12});els.forEach(function(el){io.observe(el)})}
else{els.forEach(function(el){el.classList.add('visible')})}
var g=document.getElementById('glow');
if(g&&window.matchMedia('(pointer:fine)').matches){window.addEventListener('pointermove',function(e){g.style.left=e.clientX+'px';g.style.top=e.clientY+'px'},{passive:true})}
})();

(function(){
var grid=document.getElementById('workGrid');if(!grid||!window.fetch)return;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function card(p,i){
var a=el('article','project glass reveal visible'+(p.size?' '+p.size:'')+(i%2?' delay-1':''));
var tile=el('div','logo-tile'+(p.flush?' flush':''));tile.style.setProperty('--tile',p.tile||'#ffffff');if(p.cap)tile.style.setProperty('--cap',p.cap+'px');
var img=document.createElement('img');img.src=p.logo;img.alt=p.name+' logo';if(p.w&&p.h){img.width=p.w;img.height=p.h}img.loading='lazy';img.decoding='async';tile.appendChild(img);
var info=el('div','project-info'),box=document.createElement('div');
box.appendChild(el('h3',null,p.name));box.appendChild(el('p',null,[p.location,p.role].filter(Boolean).join(' \u00b7 ')));
if(p.description)box.appendChild(el('p','project-desc',p.description));
if(p.link&&/^https?:\/\//i.test(p.link)){var l=el('a','project-link','Visit site \u2197');l.href=p.link;l.target='_blank';l.rel='noopener noreferrer';box.appendChild(l)}
var go=el('a','project-arrow','\u2197');go.href='contact.html?project='+encodeURIComponent(p.name);go.setAttribute('aria-label','Ask about '+p.name+' work');
info.appendChild(box);info.appendChild(go);a.appendChild(tile);a.appendChild(info);return a}
fetch('/api/projects',{headers:{accept:'application/json'}}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
if(!d||!Array.isArray(d.projects))return;
var frag=document.createDocumentFragment();
if(!d.projects.length)frag.appendChild(el('p','work-empty','New projects are on the way.'));
d.projects.forEach(function(p,i){frag.appendChild(card(p,i))});
grid.textContent='';grid.appendChild(frag)}).catch(function(){});
})();
