/** Representative encounter fixtures, not complete/fully statted PF1 monsters. */
import {MagicGame} from './magic.mjs';
import {initialState} from './core.mjs';
const R=ref=>({ref});

export const auraOfMenace={
  id:'archon-menace',owner:'warden',on:'zone_enter',zone:{radius:4,affects:'enemies'},
  when:[{op:'not_marked',source:R('rule.owner'),target:R('event.target'),tag:'menace-immune'},
        {op:'not_affected',source:R('rule.owner'),target:R('event.target'),name:'Aura of Menace'}],
  actions:[{op:'save',save:'will',target:R('event.target'),dc:16,
    success:[{op:'mark',source:R('rule.owner'),target:R('event.target'),tag:'menace-immune',rounds:14400}],
    failure:[{op:'apply_effect',name:'Aura of Menace',source:R('rule.owner'),target:R('event.target'),
      mods:[{stat:'attack',value:-2},{stat:'ac',value:-2},{stat:'saves',value:-2}],rounds:14400,
      // The archon subtype says 24h, or until the victim hits this archon.
      // A creature that breaks the effect becomes immune to THIS source for 24h.
      endOn:{name:'hit',when:[{op:'eq',left:R('event.actor'),right:R('effect.target')},
                              {op:'eq',left:R('event.target'),right:R('effect.source')}]},
      onEnd:[{op:'mark',source:R('effect.source'),target:R('effect.target'),tag:'menace-immune',rounds:14400}]
    }]
  }]
};

export const blackPuddingSplit={
  id:'pudding-split',owner:'warden',on:'damage_before',
  when:[{op:'eq',left:R('event.target'),right:R('rule.owner')},
        {op:'in',left:R('event.damageTypes'),right:['slashing','piercing']},
        {op:'eq',left:R('event.cause'),right:'weapon'},
        {op:'gt',left:R('owner.hp'),right:10}],
  actions:[{op:'cancel_event'},
           {op:'set_hp',target:R('rule.owner'),hp:{calc:'floor_div',a:R('owner.hp'),b:2}},
           {op:'duplicate_entity',target:R('rule.owner')}]
};

// Pathfinder 1e Choker Quickness (Su): +1 move action on each of its turns.
// Deliberately not the D&D 3.5 version, which allows a standard action.
export const chokerQuickness={
  id:'choker-quickness',owner:'warden',on:'turn_start',
  when:[{op:'eq',left:R('event.actor'),right:R('rule.owner')}],
  actions:[{op:'grant_action',target:R('rule.owner'),type:'move',count:1}]
};

export const tileHazard={
  id:'environment-hot-tile',on:'tile_enter',when:[{op:'eq',left:R('event.tile'),right:'hazard'}],
  actions:[{op:'deal_damage',target:R('event.actor'),die:4,damageType:'fire'}]
};

export const alienPresence={
  id:'vienna-alien-presence',owner:'warden',on:'zone_enter',
  // The source image specifies 360 ft; in 5-ft cells that is 72 squares,
  // much larger than this 50x40 ft demo map.
  zone:{radius:72,affects:'enemies'},when:[],
  actions:[{op:'save',save:'fort',target:R('event.target'),dc:34,
    success:[],failure:[{op:'random_relocate',target:R('event.target'),die:20,squaresPerDie:2,
      label:"Vienna's Alien Presence"}]}]
};

export function createScenario(kind='archon'){
  const s=initialState();
  s.tiles={};
  const hero=s.creatures[0],npc=s.creatures[1];
  hero.x=0;hero.y=4;hero.damageType='slashing';hero.hp=40;hero.maxHp=40;
  npc.x=5;npc.y=3; npc.damageType='bludgeoning';
  let rule;
  switch(kind){
    case 'registry':
      // No preprogrammed monster or condition. Everything is inserted at runtime.
      s.creatures=[hero];hero.x=0;hero.y=4;rule=null;break;
    case 'archon':
      npc.name='Archon (simplified)';npc.hp=60;npc.maxHp=60;rule=auraOfMenace;
      s.tiles['1,5']='hazard';
      break;
    case 'pudding':
      npc.name='Black Pudding (simplified)';npc.hp=105;npc.maxHp=105;
      npc.size=2;npc.reach=2;npc.armor=0;npc.natural=0;npc.dex=1;rule=blackPuddingSplit;
      hero.x=4;hero.y=4;
      break;
    case 'choker':
      npc.name='Choker (quickness test)';npc.hp=16;npc.maxHp=16;
      // The PF1e Bestiary Choker has 10-foot natural reach and 20-foot base speed.
      npc.size=1;npc.reach=2;npc.x=7;npc.y=3;
      npc.speed=20;hero.x=3;
      // Published natural attack routine: two primary tentacles at +6 each.
      // Grab, constrict, climb and strangle remain unimplemented.
      Object.assign(npc,{str:16,dex:14,con:13,wis:13,bab:2,armor:0,natural:4,
        sizeAttack:1,sizeCMD:-1,fortBase:1,refBase:1,willBase:3,
        damageDie:4,damageOther:0,attacks:[
          {label:'Tentacle 1',attackOffset:0,damageDie:4},
          {label:'Tentacle 2',attackOffset:0,damageDie:4}
        ]});
      rule=chokerQuickness;
      break;
    case 'vienna':
      npc.name='Vienna (aura test fixture)';npc.hp=506;npc.maxHp=506;
      // Not a faithful Gargantuan statblock: scaled to 2x2 for visibility.
      hero.x=2;hero.y=6;rule=alienPresence;break;
    default:throw new Error('Unknown fixture');
  }
  const g=new MagicGame(s);
  if(rule)g.installRule(rule);
  if(kind==='archon')g.installRule(tileHazard);
  // Set-up deliberately DOES NOT trigger nearby auras until the battlefield starts.
  // The player can see a clear before/after when clicking 'Activate encounter'.
  return g;
}

export function startScenario(g){
  g.s.encounterStarted=true;
  // Start-of-turn subscriptions also apply to the encounter's first actor.
  g.emit('turn_start',{actor:g.active().id});
  // New auras automatically evaluate every in-range creature, no AI intervention.
  g.syncZones();
  // Established encounter's start is the rollback anchor. All prior events
  // (including encounter-entry aura saves) are considered setup resolution.
  g.turnStart=JSON.parse(JSON.stringify(g.s));
  g.roundStart=JSON.parse(JSON.stringify(g.s));
  return g;
}
