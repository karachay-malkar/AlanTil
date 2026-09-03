export const GUIDE_STORY_SEQUENCE=Object.freeze(['oblivion','roots','ascent','pathways']);
export const GENERAL_GUIDE_STEPS=Object.freeze([
  {id:'intro',titleKey:'guide.general.intro.title',bodyKey:'guide.general.intro.body'},
  {id:'stories-intro',titleKey:'guide.general.stories.title',bodyKey:'guide.general.stories.body'},
  ...GUIDE_STORY_SEQUENCE.map((story)=>({id:`story:${story}`,story,titleKey:`guide.story.${story}.title`,bodyKey:`guide.story.${story}.body`})),
  {id:'summary',story:'roots',titleKey:'guide.general.summary.title',bodyKey:'guide.general.summary.body'},
  {id:'stages',titleKey:'guide.general.stages.title',bodyKey:'guide.general.stages.body'},
]);
export const STATION_GUIDE_STEPS=Object.freeze([
  {id:'study',titleKey:'guide.general.study.title',bodyKey:'guide.general.study.body'},
  {id:'test',titleKey:'guide.general.test.title',bodyKey:'guide.general.test.body'},
]);
export const LEARNING_GUIDE_STEPS=Object.freeze([
  {id:'card',titleKey:'guide.learning.card.title',bodyKey:'guide.learning.card.body'},
  {id:'translation',titleKey:'guide.learning.translation.title',bodyKey:'guide.learning.translation.body'},
  {id:'decision',titleKey:'guide.learning.decision.title',bodyKey:'guide.learning.decision.body'},
  {id:'counter',titleKey:'guide.learning.counter.title',bodyKey:'guide.learning.counter.body'},
  {id:'favorite',titleKey:'guide.learning.favorite.title',bodyKey:'guide.learning.favorite.body'},
]);
export const LEARNING_REPEAT_GUIDE_STEP=Object.freeze({id:'repeat',titleKey:'guide.learning.repeat.title',bodyKey:'guide.learning.repeat.body'});
export function guideStepAt(flow,index){const list=flow==='learning'?LEARNING_GUIDE_STEPS:flow==='station'?STATION_GUIDE_STEPS:GENERAL_GUIDE_STEPS;return list[Math.max(0,Math.min(list.length-1,Number(index)||0))]||null;}
