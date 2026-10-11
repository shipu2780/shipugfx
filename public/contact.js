(function(){
var d=document.getElementById('book-date');
if(d){var t=new Date();d.min=new Date(t.getTime()-t.getTimezoneOffset()*60000).toISOString().slice(0,10)}
var p=new URLSearchParams(location.search).get('project'),f=document.getElementById('project');
if(p&&f){f.value='I would like to discuss work related to '+p+'.\n\n';var s=document.getElementById('service');if(s)s.focus()}
})();
