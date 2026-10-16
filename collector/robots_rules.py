"""Small REP matcher for the ASCII public URLs used by this collector.
Preserves literal question marks in rules and supports wildcard / end anchors.
Python urllib.robotparser normalizes a trailing '?' away; that incorrectly turns
Target's /s? search rule into a /s prefix that would also cover /sl/ store pages.
"""
import re
from urllib.parse import urlsplit
class Rules:
 def __init__(self,text):
  self.groups=[];agents=[];rules=[];delay=None;directives=False
  for raw in text.splitlines():
   line=raw.split('#',1)[0].strip()
   if ':' not in line:continue
   key,value=(s.strip() for s in line.split(':',1));key=key.lower()
   if key=='user-agent':
    if directives:self.groups.append((agents,rules,delay));agents=[];rules=[];delay=None;directives=False
    agents.append(value.lower())
   elif agents and key in ('allow','disallow','crawl-delay'):
    directives=True
    if key=='crawl-delay':
     try:delay=float(value)
     except ValueError:pass
    elif value:rules.append((key,value))
  if agents:self.groups.append((agents,rules,delay))
 def selected(self,ua):
  ua=ua.lower();rank=-1;selected=[]
  for agents,rules,delay in self.groups:
   score=max((0 if a=='*' else len(a) for a in agents if a=='*' or a in ua),default=-1)
   if score>rank:rank=score;selected=[(rules,delay)]
   elif score==rank and score>=0:selected.append((rules,delay))
  return selected if rank>=0 else []
 def can_fetch(self,ua,url):
  u=urlsplit(url);path=u.path+('?' + u.query if u.query else '')
  matches=[]
  for rules,_ in self.selected(ua):
   for kind,rule in rules:
    end=rule.endswith('$');pattern=rule[:-1] if end else rule
    rx='^'+re.escape(pattern).replace(r'\*','.*')+('$' if end else '')
    if re.search(rx,path):matches.append((len(pattern.replace('*','')),kind=='allow'))
  return max(matches)[1] if matches else True
 def crawl_delay(self,ua):return max((d or 0 for _,d in self.selected(ua)),default=0)
