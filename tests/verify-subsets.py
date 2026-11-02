"""Independent full-world uniqueness and exact omitted-testimony leakage tests."""
import json,itertools
from pathlib import Path

def evaluate(e,w):
 t=e['type']
 if t=='eq':return w[e['field']]==e['value']
 if t=='ne':return w[e['field']]!=e['value']
 if t=='and':return all(evaluate(x,w)for x in e['args'])
 if t=='or':return any(evaluate(x,w)for x in e['args'])
 if t=='not':return not evaluate(e['arg'],w)
 if t=='fieldEq':return w[e['left']]==w[e['right']]
 if t=='ltField':return w[e['left']]<w[e['right']]
 if t=='offsetEq':
  v=w[e['right']]+e['offset']
  if 'mod'in e:v%=e['mod']
  return w[e['left']]==v
 raise ValueError(t)

def possible_liar_masks(mask,world_masks,k,stop_at_two=False):
 unknown=[i for i in range(12)if not mask&(1<<i)];result=set()
 for m in world_masks:
  false=m&mask;r=k-false.bit_count()
  if not 0<=r<=len(unknown):continue
  for rest in itertools.combinations(unknown,r):
   result.add(false|sum(1<<i for i in rest))
   if stop_at_two and len(result)>=2:return result
 return result

p=Path(__file__).resolve().parent.parent/'src/data/puzzles.json';D=json.loads(p.read_text(encoding='utf-8'))
for l in D['levels']:
 assert len(l['statements'])==12 and sorted(s['speaker']for s in l['statements'])==list(range(12))
 masks=[sum(1<<s['speaker']for s in l['statements']if not evaluate(s['expr'],w))for w in l['worlds']]
 survivors=[i for i,m in enumerate(masks)if m.bit_count()==l['liarCount']]
 assert len(survivors)==1
 final=masks[survivors[0]]
 assert final==sum(1<<i for i in l['answer'])
 assert l['solutionWorld']==l['worlds'][survivors[0]]
 minimum=None;examples=[]
 for size in range(1,13):
  for sub in itertools.combinations(range(12),size):
   mask=sum(1<<i for i in sub)
   if len(possible_liar_masks(mask,masks,l['liarCount'],True))==1:examples.append(sub)
  if examples:minimum=size;break
 first3=len(possible_liar_masks(7,masks,l['liarCount']))
 assert minimum>=9
 l['verification'].update({'minimumTestimonySubsetForUniqueLiarSet':minimum,'firstThreePossibleLiarSets':first3,'uniqueMinimumSubsetCount':len(examples),'minimumSubsetExamples':[list(t)for t in examples[:3]],'subsetTestDefinition':'Only selected testimonies constrain speaker identity. For each public-evidence world, false selected statements identify liar speakers; remaining liar slots are freely allocated among unobserved speakers. Collect all possible complete liar sets.'})
 print(json.dumps({'case':l['id'],'worlds':len(l['worlds']),'survivingWorlds':1,'answer':l['answer'],'minimumSubset':minimum,'first3LiarSets':first3,'example':examples[:1]},ensure_ascii=False))
print('All public-evidence worlds and all testimony subsets validated.')
# Verify human-readable contradiction certificates independently.
for l in D['levels']:
 for branch in l.get('deductionGroups',[]):
  ws=[w for w in l['worlds'] if w['mode']==branch['mode']]
  for group in branch['groups']:
   assert not any(all(evaluate(l['statements'][i]['expr'],w)for i in group)for w in ws), (l['id'],group)
  covers=[list(c) for c in itertools.combinations(range(12),3)if all(set(c)&set(g)for g in branch['groups'])]
  assert covers==([l['answer']]if branch['mode']==l['solutionWorld']['mode']else[]),(l['id'],branch['mode'],covers)
 print(l['id'],'all human contradiction groups true; wrong branches impossible with 3 liars; retained branch one 3-person cover')
