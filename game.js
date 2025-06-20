let avatars = {};
let monsters = [];
let monstersLoaded = false;
fetch("data/monsters.json").then(r=>r.json()).then(d=>{monsters=d;monstersLoaded=true;});
let avatarsLoaded = false;
fetch("data/avatars.json")
  .then(r => r.json())
  .then(data => { avatars = data; avatarsLoaded = true; });
let itemNames = {};
let itemsLoaded = false;
fetch("data/items.json")
  .then(r => r.json())
  .then(data => { itemNames = data; itemsLoaded = true; });
const backgrounds={
    Knight:'knight-bg',
    Mage:'mage-bg',
    Rogue:'rogue-bg'
};
const nextPurchase={weapon:null,armor:null,artifact:null};
let shopStock={weapon:null,armor:null,artifact:null};
function colorName(name,rarity){
    return `<span class="rarity-${rarity}">${name}</span>`;
}
function getRarityByName(name){
    for(const cat of Object.values(itemNames)){
        for(const r in cat){
            if(cat[r].includes(name)) return r;
        }
    }
    return 'common';
}
let players=[];
let current=0;
let defending=[false,false];
let defendMult=[1,1];
let stun=[0,0];
let poison=[0,0];
let cooldown=[0,0];
let cooldownBase=[3,3];
let coins=0;
let inventory={
    weapon:{common:[],rare:[],epic:[],legendary:[]},
    armor:{common:[],rare:[],epic:[],legendary:[]},
    artifact:{common:[],rare:[],epic:[],legendary:[]}
};
let xp=0;
let level=0;
let xpData={Knight:{xp:0,level:0},Mage:{xp:0,level:0},Rogue:{xp:0,level:0}};
let currentAvatar=null;
let isCampaign=false;
let campaignLevel=1;
let cpuCoins=0;
let battleNumber=1;
let isBoss=false;
let currentBattleIsBoss=false;
let lastRewardCoins=0;
let lastLootMsg='';
let lastBattleWon=false;
const log=document.getElementById('log');
function colorLog(msg){
    if(players.length>0){
        msg=msg.replaceAll(players[0].name,`<span class="log-player-name">${players[0].name}</span>`);
    }
    if(players.length>1){
        msg=msg.replaceAll(players[1].name,`<span class="log-enemy-name">${players[1].name}</span>`);
    }
    return msg;
}
function logMsg(msg){log.innerHTML+=colorLog(msg)+'<br>';log.scrollTop=log.scrollHeight;}

loadProgress();
updateCoins();

function resetShop(){
    for(const type of ['weapon','armor','artifact']){
        const r=randomRarity();
        shopStock[type]={name:randomItemName(type,r),rarity:r};
    }
}

function setButtons(enabled){
    document.getElementById('attack-btn').disabled=!enabled;
    document.getElementById('defend-btn').disabled=!enabled;
    document.getElementById('special-btn').disabled=!enabled;
}

function saveProgress(){
    localStorage.setItem('aaCoins', coins);
    localStorage.setItem('aaInv', JSON.stringify(inventory));
    localStorage.setItem('aaXPData', JSON.stringify(xpData));
}

function loadProgress(){
    const saved=localStorage.getItem('aaCoins');
    if(saved) coins=parseInt(saved);
    const xpStr=localStorage.getItem('aaXPData');
    if(xpStr){
        try{ xpData=JSON.parse(xpStr); }catch(e){}
    }
    for(const av of ['Knight','Mage','Rogue']){
        if(!xpData[av]) xpData[av]={xp:0,level:0};
    }
    const inv=localStorage.getItem('aaInv');
    if(inv){
        const data=JSON.parse(inv);
        if(Array.isArray(data.weapon?.common)){
            inventory=data;
        }else{
            inventory={
                weapon:{common:Array(data.weapon).fill('Common Weapon'),rare:[],epic:[],legendary:[]},
                armor:{common:Array(data.armor).fill('Common Armor'),rare:[],epic:[],legendary:[]},
                artifact:{common:Array(data.artifact).fill('Common Artifact'),rare:[],epic:[],legendary:[]}
            };
        }
        // ensure new legendary arrays exist
        for(const cat of ['weapon','armor','artifact']){
            if(!inventory[cat].legendary) inventory[cat].legendary=[];
        }
    }
}

function updateCoins(){
    const top=document.getElementById('coins-top');
    if(top) top.textContent=coins;
    const lvl=document.getElementById('level');
    const xpEl=document.getElementById('xp');
    if(lvl) lvl.textContent=level;
    if(xpEl) xpEl.textContent=xp;
    saveProgress();
    updateInventoryUI();
}

function showBack(screen){
    history.pushState({screen}, "");
}
function hideBack(){}

function updateInventoryUI(){
    const fmt=(inv)=>`Common:<span class="rarity-common">${inv.common.length}</span> `+
        `Rare:<span class="rarity-rare">${inv.rare.length}</span> `+
        `Epic:<span class="rarity-epic">${inv.epic.length}</span> `+
        `Legendary:<span class="rarity-legendary">${inv.legendary.length}</span>`;
    const w=document.getElementById('inv-weapon');
    const a=document.getElementById('inv-armor');
    const t=document.getElementById('inv-artifact');
    if(w) w.innerHTML=fmt(inventory.weapon);
    if(a) a.innerHTML=fmt(inventory.armor);
    if(t) t.innerHTML=fmt(inventory.artifact);
}

function updateEquipInfo(){
    if(players.length){
        const p=players[0];
        const info=`Weapons: ${p.equipment.weapon.length}/${p.slots.weapon} `+
        `Armor: ${p.equipment.armor.length}/${p.slots.armor} `+
        `Artifacts: ${p.equipment.artifact.length}/${p.slots.artifact}`;
        document.getElementById('equip-info').textContent=info;
        const el=document.getElementById('equip-info-loadout');
        if(el) el.textContent=info;
    }
}

function updateLoadout(){
    if(document.getElementById('loadout-stats')){
        document.getElementById('loadout-stats').textContent=
        `HP: ${players[0].maxHp} ATK: ${players[0].atk} DEF: ${players[0].def} EN: ${players[0].energy}/${players[0].maxEnergy}`;
    }
}

document.querySelectorAll('.avatar-grid button').forEach(btn=>{
    btn.addEventListener('click',()=>{
        if(!avatarsLoaded){
            alert('Avatars are still loading. Please try again.');
            return;
        }
        const avatar=btn.dataset.avatar;
        const data=avatars[avatar];
        if(!data) return;
        currentAvatar=avatar;
        const info=xpData[avatar]||{xp:0,level:0};
        xp=info.xp;
        level=info.level;
        players[0]={
            ...data,
            name:`Player (${data.emoji} ${avatar})`,
            maxHp:data.hp + level*5,
            maxEnergy:data.energy,
            energy:data.energy,
            atk:data.atk + level,
            def:data.def + level,
            img:`assets/avatars/${avatar.toLowerCase()}.png`,
            equipment:{weapon:[],armor:[],artifact:[]},
            slots:data.slots
        };
        document.body.className=backgrounds[avatar]||'';
    resetShop();
    showLoadout();
    });
});

function showLoadout(){
    document.getElementById('selection-screen').classList.add('hidden');
    document.getElementById('loadout-screen').classList.remove('hidden');
    document.getElementById('victory-screen').classList.add('hidden');
    document.getElementById('defeat-screen').classList.add('hidden');
    document.getElementById('battle-screen').classList.add('hidden');
    showBack("loadout");
    document.getElementById('loadout-name').textContent=players[0].name;
    document.getElementById('loadout-model').innerHTML=`<img src="${players[0].img}" class="battle-img">`;
    document.getElementById('loadout-stats').textContent=`HP: ${players[0].maxHp} ATK: ${players[0].atk} DEF: ${players[0].def}`;
    document.getElementById('lore').textContent=players[0].lore;
    updateCoins();
    updateEquipInfo();
    updateLoadout();
    updateInventoryUI();
}

function startBattle(){
    document.getElementById('loadout-screen').classList.add('hidden');
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('victory-screen').classList.add('hidden');
    document.getElementById('defeat-screen').classList.add('hidden');
    document.getElementById('battle-screen').classList.remove('hidden');
    showBack("battle");
    lastBattleWon=false;
    const lvlEl=document.getElementById('level-indicator');
    if(isCampaign){
        lvlEl.textContent=`Level ${campaignLevel}`;
        lvlEl.classList.remove('hidden');
    }else{
        lvlEl.textContent='';
        lvlEl.classList.add('hidden');
    }
    resetShop();
    let enemy;
    currentBattleIsBoss=isBoss;
    if(isCampaign){
        enemy=monsters[campaignLevel-1];
        players[1]={
            ...enemy,
            name:enemy.name,
            maxHp:enemy.hp,
            maxEnergy:enemy.energy,
            energy:enemy.energy,
            img:`assets/monsters/${enemy.name.toLowerCase()}.png`,
            equipment:{weapon:[],armor:[],artifact:[]},
            slots:{weapon:0,armor:0,artifact:0}
        };
    }else{
        const keys=Object.keys(avatars);
        const enemyKey=keys[Math.floor(Math.random()*keys.length)];
        const baseName=currentBattleIsBoss?(
            enemyKey==='Rogue'? 'Renegade Rogue':
            enemyKey==='Knight'? 'Mega Knight':'Master Mage'
        ):`CPU (${avatars[enemyKey].emoji} ${enemyKey})`;
        enemy=avatars[enemyKey];
        players[1]={
            ...enemy,
            name:baseName,
            maxHp:enemy.hp,
            maxEnergy:enemy.energy,
            energy:enemy.energy,
            img:`assets/avatars/${enemyKey.toLowerCase()}.png`,
            equipment:{weapon:[],armor:[],artifact:[]},
            slots:enemy.slots
        };
    }
    if(currentBattleIsBoss){
        players[1].maxHp=Math.round(players[1].maxHp*2);
        players[1].atk=Math.round(players[1].atk*1.5);
        players[1].def=Math.round(players[1].def*1.5);
        players[1].maxEnergy+=20;
        isBoss=false;
    }
    players[0].hp=players[0].maxHp;
    players[1].hp=players[1].maxHp;
    players[0].energy=players[0].maxEnergy;
    players[1].energy=players[1].maxEnergy;
    current=0;
    defending=[false,false];
    defendMult=[1,1];
    stun=[0,0];
    poison=[0,0];
    cooldown=[0,0];
    cooldownBase=[3,3];
    log.innerHTML='';
    updateUI();
    updateCoins();
    updateEquipInfo();
    logMsg(`Battle ${battleNumber} Start!`);
    updateTurn();
}

function updateUI(){
    for(let i=0;i<2;i++){
        document.getElementById('p'+(i+1)+'-name').textContent=players[i].name;
        document.getElementById('p'+(i+1)+'-model').innerHTML=`<img src="${players[i].img}" class="battle-img">`;
        document.getElementById('p'+(i+1)+'-stats').textContent=`HP: ${Math.max(0,players[i].hp)}/${players[i].maxHp} ATK: ${players[i].atk} DEF: ${players[i].def} EN: ${players[i].energy}/${players[i].maxEnergy}`;
        const p=players[i];
        document.getElementById('p'+(i+1)+'-equip').textContent=
            `Weapons: ${p.equipment.weapon.length}/${p.slots.weapon} `+
            `Armor: ${p.equipment.armor.length}/${p.slots.armor} `+
            `Artifacts: ${p.equipment.artifact.length}/${p.slots.artifact}`;
        const ratio=Math.max(0,players[i].hp)/players[i].maxHp*100;
        const bar=document.getElementById('p'+(i+1)+'-health');
        bar.style.width=ratio+'%';
        bar.style.background=ratio>50?'#4caf50':ratio>20?'#ffeb3b':'#f44336';
        const eratio=Math.max(0,players[i].energy)/players[i].maxEnergy*100;
        const ebar=document.getElementById('p'+(i+1)+'-energy');
        if(ebar) ebar.style.width=eratio+'%';
    }
    updateEquipInfo();
}

function endTurn(){
    for(let i=0;i<2;i++){
        if(poison[i]>0){
            players[i].hp-=5;
            poison[i]--;
            logMsg(`${players[i].name} takes 5 poison damage.`);
        }
    }
    if(checkVictory()) { updateUI(); return; }
    current=1-current;
    defending[current]=false;
    defendMult[current]=1;
    if(cooldown[current]>0)cooldown[current]--;
    updateUI();
    const over=checkVictory();
    if(!over){
        updateTurn();
    }
}

function cpuAction(){
    const actor=players[current];
    const ready=cooldown[current]===0 && actor.energy>=actor.maxEnergy*0.5;
    let choice;
    if(ready){
        const roll=Math.floor(Math.random()*3);
        choice=roll===0?'attack':roll===1?'defend':'special';
    }else{
        choice=Math.random()<0.5?'attack':'defend';
    }
    if(choice==='attack') attack();
    else if(choice==='defend') defend();
    else special();
}

let cpuTimer=null;
function scheduleCpuTurn(){
    if(cpuTimer) clearTimeout(cpuTimer);
    cpuTimer=setTimeout(()=>{
        cpuTimer=null;
        if(current===1) cpuAction();
    },500);
}

function updateTurn(){
    document.getElementById('turn-indicator').textContent=`${players[current].name}'s Turn`;
    setButtons(current===0);
    if(stun[current]>0){
        logMsg(`${players[current].name} is stunned and skips a turn.`);
        stun[current]--;
        endTurn();
        return;
    }
    if(current===1){
        scheduleCpuTurn();
    }
}

function attack(){
    const attacker=players[current];
    const defender=players[1-current];
    if(Math.random()<0.05){
        logMsg(`${defender.name} dodged the attack!`);
        defending[current]=false;
        endTurn();
        return;
    }
    let dmg=attacker.atk;
    if(defending[1-current]){
        dmg=Math.round(dmg*defendMult[1-current]);
    }
    let crit=false;
    if(Math.random()<0.15){
        dmg*=2;
        crit=true;
    }
    defender.hp-=dmg;
    logMsg(`${attacker.name} attacks for ${dmg} damage.${crit?' Critical hit!':''}`);
    if(checkVictory()) return;
    defending[current]=false;
    endTurn();
}

function defend(){
    defending[current]=true;
    const roll=Math.random();
    if(roll<0.02){
        defendMult[current]=0;
        logMsg(`${players[current].name} prepares a perfect block!`);
    }else if(roll<0.05){
        defendMult[current]=0.25;
        logMsg(`${players[current].name} braces to block 75% damage.`);
    }else if(roll<0.10){
        defendMult[current]=0.5;
        logMsg(`${players[current].name} braces to block 50% damage.`);
    }else if(roll<0.20){
        defendMult[current]=0.75;
        logMsg(`${players[current].name} braces to block 25% damage.`);
    }else{
        const pct=Math.min(0.99, players[current].def/100);
        defendMult[current]=1-pct;
        logMsg(`${players[current].name} blocks ${Math.round(pct*100)}% damage.`);
    }
    endTurn();
}

function special(){
    if(cooldown[current]>0){
        logMsg(`Special on cooldown: ${cooldown[current]} turn(s) left.`);
        if(current===1) endTurn();
        return;
    }
    const attacker=players[current];
    if(attacker.energy<attacker.maxEnergy*0.5){
        logMsg('Not enough energy.');
        if(current===1) endTurn();
        return;
    }
    attacker.energy=Math.max(0,attacker.energy - Math.floor(attacker.maxEnergy*0.5));
    const defender=players[1-current];
    if(Math.random()<0.05){
        logMsg(`${defender.name} dodged the special attack!`);
        cooldown[current]=cooldownBase[current];
        defending[current]=false;
        endTurn();
        return;
    }
    const name=attacker.name;
    if(name.includes('Knight')){
        let dmg=attacker.atk;
        if(defending[1-current]){
            dmg=Math.round(dmg*defendMult[1-current]);
        }
        if(Math.random()<0.15){dmg*=2;logMsg('Critical hit!');}
        defender.hp-=dmg;
        stun[1-current]=1;
        logMsg(`${attacker.name} uses Shield Bash for ${dmg} damage! Enemy stunned.`);
        if(checkVictory()) { cooldown[current]=cooldownBase[current]; defending[current]=false; return; }
    }else if(name.includes('Mage')){
        if(Math.random()<0.7){
            let dmg=Math.max(15,Math.round(attacker.atk*2));
            if(defending[1-current]){
                dmg=Math.round(dmg*defendMult[1-current]);
            }
            if(Math.random()<0.15){dmg*=2;logMsg('Critical hit!');}
            defender.hp-=dmg;
            logMsg(`${attacker.name} casts Fireball for ${dmg} damage.`);
            if(checkVictory()) { cooldown[current]=cooldownBase[current]; defending[current]=false; return; }
        }else{
            logMsg(`${attacker.name}'s Fireball missed!`);
        }
    }else if(name.includes('Rogue')){
        let dmg=attacker.atk;
        if(defending[1-current]){
            dmg=Math.round(dmg*defendMult[1-current]);
        }
        if(Math.random()<0.15){dmg*=2;logMsg('Critical hit!');}
        defender.hp-=dmg;
        poison[1-current]=3;
        logMsg(`${attacker.name} uses Poison Dagger for ${dmg} damage. Enemy poisoned!`);
        if(checkVictory()) { cooldown[current]=cooldownBase[current]; defending[current]=false; return; }
    }else if(name.includes('Ghoul')){
        let dmg=attacker.atk;
        if(defending[1-current]){ dmg=Math.round(dmg*defendMult[1-current]); }
        defender.hp-=dmg;
        attacker.hp=Math.min(attacker.maxHp, attacker.hp+dmg);
        logMsg(`${attacker.name} drains ${dmg} health.`);
        if(checkVictory()) { cooldown[current]=cooldownBase[current]; defending[current]=false; return; }
    }else if(name.includes('Skeleton')){
        defending[current]=true;
        defendMult[current]=0.25;
        logMsg(`${attacker.name} raises a bone shield!`);
    }else if(name.includes('Banshee')){
        stun[1-current]=1;
        logMsg(`${attacker.name} lets out a terrifying scream!`);
    }else if(name.includes('Cyclops')){
        let dmg=Math.max(15,Math.round(attacker.atk*2));
        if(defending[1-current]){ dmg=Math.round(dmg*defendMult[1-current]); }
        defender.hp-=dmg;
        logMsg(`${attacker.name} smashes for ${dmg} damage!`);
        if(checkVictory()) { cooldown[current]=cooldownBase[current]; defending[current]=false; return; }
    }else if(name.includes('Demon')){
        let dmg=Math.max(15,Math.round(attacker.atk*2));
        if(defending[1-current]){ dmg=Math.round(dmg*defendMult[1-current]); }
        defender.hp-=dmg;
        poison[1-current]=3;
        logMsg(`${attacker.name} engulfs you in hellfire for ${dmg} damage!`);
        if(checkVictory()) { cooldown[current]=cooldownBase[current]; defending[current]=false; return; }
    }else if(name.includes('Minotaur')){
        let dmg=Math.max(20, Math.round(attacker.atk*1.5));
        defender.hp-=dmg;
        logMsg(`${attacker.name} charges dealing ${dmg} damage!`);
        if(checkVictory()) { cooldown[current]=cooldownBase[current]; defending[current]=false; return; }
    }else if(name.includes('Gargoyle')){
        attacker.def+=4;
        logMsg(`${attacker.name}'s skin hardens like stone, increasing defense!`);
    }else if(name.includes('Vampire')){
        let dmg=Math.max(15,Math.round(attacker.atk*2));
        if(defending[1-current]){ dmg=Math.round(dmg*defendMult[1-current]); }
        defender.hp-=dmg;
        attacker.hp=Math.min(attacker.maxHp, attacker.hp+Math.round(dmg/2));
        logMsg(`${attacker.name} bites for ${dmg} damage and heals.`);
        if(checkVictory()) { cooldown[current]=cooldownBase[current]; defending[current]=false; return; }
    }else if(name.includes('Hydra')){
        attacker.hp=Math.min(attacker.maxHp, attacker.hp+30);
        logMsg(`${attacker.name} regenerates 30 HP!`);
    }else if(name.includes('Dragon')){
        let dmg=Math.max(25,Math.round(attacker.atk*2));
        if(defending[1-current]){ dmg=Math.round(dmg*defendMult[1-current]); }
        defender.hp-=dmg;
        logMsg(`${attacker.name} breathes fire for ${dmg} damage!`);
        if(checkVictory()) { cooldown[current]=cooldownBase[current]; defending[current]=false; return; }
    }
    cooldown[current]=cooldownBase[current];
    defending[current]=false;
    endTurn();
}

function checkVictory(){
    if(players[0].hp<=0 || players[1].hp<=0){
        document.getElementById('battle-screen').classList.add('hidden');
        const playerWon = players[1].hp<=0;
        lastBattleWon = playerWon;
        if(playerWon){
            document.getElementById('victory-screen').classList.remove('hidden');
            document.getElementById('defeat-screen').classList.add('hidden');
            document.getElementById('winner').textContent=`${players[0].name} Wins!`;
            const reward=currentBattleIsBoss?20:10;
            lastRewardCoins=reward;
            coins+=reward;
            cpuCoins+=10;
            logMsg(`You earned ${reward} coins!`);
            lastLootMsg=tryLoot();
            document.getElementById('victory-img').src=players[0].img;
            document.getElementById('victory-reward').textContent=`+${reward} coins. ${lastLootMsg}`;
            addXP(50);
            if(isCampaign && campaignLevel<monsters.length){
                document.getElementById('next-btn').classList.remove('hidden');
            }else{
                document.getElementById('next-btn').classList.add('hidden');
                if(isCampaign && campaignLevel>=monsters.length){
                    logMsg('Campaign complete!');
                    isCampaign=false;
                }
            }
            showConfetti();
        }else{
            document.getElementById('victory-screen').classList.add('hidden');
            document.getElementById('defeat-screen').classList.remove('hidden');
            document.getElementById('loser').textContent=`Defeated by ${players[1].name}`;
            lastRewardCoins=5;
            coins+=5;
            cpuCoins+=20;
            lastLootMsg='';
            logMsg('You earned 5 coins.');
            document.getElementById('defeat-img').src=players[1].img;
            document.getElementById('defeat-reward').textContent=`+5 coins.`;
            document.getElementById('next-btn').classList.add('hidden');
        }
        updateCoins();
        updateEquipInfo();
        currentBattleIsBoss=false;
        return true;
    }
    return false;
}

function nextBattle(){
    document.getElementById('next-btn').classList.add('hidden');
    if(isCampaign){
        campaignLevel++;
        if(campaignLevel>monsters.length){
            isCampaign=false;
            showLoadout();
            return;
        }
        startBattle();
    }else{
        battleNumber++;
        startBattle();
    }
}

function equipWeapon(){
    if(players[0].equipment.weapon.length>=players[0].slots.weapon){
        logMsg('No weapon slots left.');
        return;
    }
    const rarity=randomRarity();
    const name=randomItemName('weapon',rarity);
    players[0].equipment.weapon.push(name);
    inventory.weapon[rarity].push(name);
    players[0].atk+=rarity==='legendary'?8:rarity==='epic'?6:rarity==='rare'?4:2;
    logMsg(`Equipped ${colorName(name,rarity)}.`);
    updateCoins();
    updateEquipInfo();
    updateLoadout();
    updateUI();
}
function equipArmor(){
    if(players[0].equipment.armor.length>=players[0].slots.armor){
        logMsg('No armor slots left.');
        return;
    }
    const rarity=randomRarity();
    const name=randomItemName('armor',rarity);
    players[0].equipment.armor.push(name);
    inventory.armor[rarity].push(name);
    players[0].def+=rarity==='legendary'?8:rarity==='epic'?6:rarity==='rare'?4:2;
    logMsg(`Equipped ${colorName(name,rarity)}.`);
    updateCoins();
    updateEquipInfo();
    updateLoadout();
    updateUI();
}
function equipArtifact(){
    if(players[0].equipment.artifact.length>=players[0].slots.artifact){
        logMsg('No artifact slots left.');
        return;
    }
    const rarity=randomRarity();
    const name=randomItemName('artifact',rarity);
    players[0].equipment.artifact.push(name);
    inventory.artifact[rarity].push(name);
    if(rarity==='legendary'){cooldownBase[0]=Math.max(1,cooldownBase[0]-4);players[0].maxHp+=40;players[0].maxEnergy+=20;}
    else if(rarity==='epic'){cooldownBase[0]=Math.max(1,cooldownBase[0]-3);players[0].maxHp+=30;players[0].maxEnergy+=15;}
    else if(rarity==='rare'){cooldownBase[0]=Math.max(1,cooldownBase[0]-2);players[0].maxHp+=20;players[0].maxEnergy+=10;}
    else {cooldownBase[0]=Math.max(1,cooldownBase[0]-1);players[0].maxHp+=10;players[0].maxEnergy+=5;}
    players[0].energy=players[0].maxEnergy;
    logMsg(`Equipped ${colorName(name,rarity)}.`);
    updateCoins();
    updateEquipInfo();
    updateLoadout();
    updateUI();
}

function randomRarity(){
    const roll=Math.random();
    if(roll<0.5) return 'common';
    if(roll<0.8) return 'rare';
    if(roll<0.95) return 'epic';
    return 'legendary';
}

function randomItemName(type,rarity){
    const list=itemNames[type]?.[rarity]||[];
    if(!list.length) return 'Unknown';
    return list[Math.floor(Math.random()*list.length)];
}

function purchase(type,cost){
    if(coins>=cost){
        coins-=cost;
        const {name,rarity}=shopStock[type];
        inventory[type][rarity].push(name);
        logMsg(`Purchased ${colorName(name,rarity)}.`);
        // Immediately generate a new item for the purchased slot
        const r=randomRarity();
        shopStock[type]={name:randomItemName(type,r),rarity:r};
        nextPurchase[type]=null;
        document.getElementById(`buy-${type}-btn`).removeAttribute('title');
        document.getElementById('preview').textContent='';
        updateCoins();
    }else{
        logMsg('Not enough coins.');
    }
}

function buyWeapon(){ purchase('weapon',10); }
function buyArmor(){ purchase('armor',10); }
function buyArtifact(){ purchase('artifact',20); }

function giveRandomLoot(){
    const typeRoll=Math.random();
    const rarity=randomRarity();
    let msg='';
    if(typeRoll<0.33){
        const name=randomItemName('weapon',rarity);
        inventory.weapon[rarity].push(name);
        msg=`Found ${name} (${rarity.charAt(0).toUpperCase()+rarity.slice(1)})!`;
        logMsg(colorName(msg,rarity));
    }else if(typeRoll<0.66){
        const name=randomItemName('armor',rarity);
        inventory.armor[rarity].push(name);
        msg=`Found ${name} (${rarity.charAt(0).toUpperCase()+rarity.slice(1)})!`;
        logMsg(colorName(msg,rarity));
    }else{
        const name=randomItemName('artifact',rarity);
        inventory.artifact[rarity].push(name);
        msg=`Found ${name} (${rarity.charAt(0).toUpperCase()+rarity.slice(1)})!`;
        logMsg(colorName(msg,rarity));
    }
    updateCoins();
    return msg;
}

function tryLoot(){
    if(Math.random()<0.3){
        return giveRandomLoot();
    }else{
        const msg='No drops this time.';
        logMsg(msg);
        return msg;
    }
}

function addXP(amount){
    xp+=amount;
    while(xp>=100){
        xp-=100;
        level++;
        players[0].atk+=1;
        players[0].def+=1;
        players[0].maxHp+=5;
        players[0].hp+=5;
        logMsg(`Level up! Now level ${level}.`);
    }
    xpData[currentAvatar]={xp,level};
    updateCoins();
    updateLoadout();
    updateUI();
}

function closeShop(){
    document.getElementById('shop-screen').classList.add('hidden');
}

function showCustom(){
    document.getElementById('loadout-screen').classList.add('hidden');
    document.getElementById('custom-screen').classList.remove('hidden');
    showBack("custom");
    populateCustom();
}

function hideCustom(){
    document.getElementById('custom-screen').classList.add('hidden');
    document.getElementById('loadout-screen').classList.remove('hidden');
}

function populateCustom(){
    const p=players[0];
    const colorize=(name)=>colorName(name,getRarityByName(name));

    const buildList=(el,arr,type)=>{
        el.innerHTML='';
        if(!arr.length){el.textContent='None';return;}
        arr.forEach((name,i)=>{
            const div=document.createElement('div');
            div.className='equip-item';
            const span=document.createElement('span');
            span.innerHTML=colorize(name);
            const btn=document.createElement('button');
            btn.textContent='✖️';
            btn.className='unequip-btn';
            btn.onclick=()=>unequipItem(type,i);
            div.appendChild(span);
            div.appendChild(btn);
            el.appendChild(div);
        });
    };
   
    buildList(document.getElementById('weapon-list'),p.equipment.weapon,'weapon');
    buildList(document.getElementById('armor-list'),p.equipment.armor,'armor');
    buildList(document.getElementById('artifact-list'),p.equipment.artifact,'artifact');

    const wSel=document.getElementById('weapon-select');
    const aSel=document.getElementById('armor-select');
    const tSel=document.getElementById('artifact-select');
    const fill=(sel,arr)=>{ sel.innerHTML=''; arr.forEach(n=>{const o=document.createElement('option');o.textContent=n;sel.appendChild(o);}); };
    fill(wSel,[...inventory.weapon.common,...inventory.weapon.rare,...inventory.weapon.epic,...inventory.weapon.legendary]);
    fill(aSel,[...inventory.armor.common,...inventory.armor.rare,...inventory.armor.epic,...inventory.armor.legendary]);
    fill(tSel,[...inventory.artifact.common,...inventory.artifact.rare,...inventory.artifact.epic,...inventory.artifact.legendary]);
}

function equipSelected(type){
    const sel=document.getElementById(type+'-select');
    const name=sel.value;
    if(!name) return;
    const inv=inventory[type];
    let rarity='';
    for(const r of ['legendary','epic','rare','common']){
        const idx=inv[r].indexOf(name);
        if(idx>-1){inv[r].splice(idx,1);rarity=r;break;}
    }
    if(!rarity){return;}
    const p=players[0];
    if(p.equipment[type].length>=p.slots[type]){logMsg('No '+type+' slots left.'); return;}
    p.equipment[type].push(name);
    if(type==='weapon'){
        p.atk+=rarity==='legendary'?8:rarity==='epic'?6:rarity==='rare'?4:2;
    }
    if(type==='armor'){
        p.def+=rarity==='legendary'?8:rarity==='epic'?6:rarity==='rare'?4:2;
    }
    if(type==='artifact'){
        if(rarity==='legendary'){cooldownBase[0]=Math.max(1,cooldownBase[0]-4);p.maxHp+=40;p.maxEnergy+=20;}
        else if(rarity==='epic'){cooldownBase[0]=Math.max(1,cooldownBase[0]-3);p.maxHp+=30;p.maxEnergy+=15;}
        else if(rarity==='rare'){cooldownBase[0]=Math.max(1,cooldownBase[0]-2);p.maxHp+=20;p.maxEnergy+=10;}
        else {cooldownBase[0]=Math.max(1,cooldownBase[0]-1);p.maxHp+=10;p.maxEnergy+=5;}
        p.energy=p.maxEnergy;
    }
    populateCustom();
    updateCoins();
    updateEquipInfo();
    updateLoadout();
    updateUI();
}
function unequipItem(type,index){
    const p=players[0];
    const name=p.equipment[type][index];
    if(!name) return;
    const rarity=getRarityByName(name);
    p.equipment[type].splice(index,1);
    inventory[type][rarity].push(name);
    if(type==='weapon'){
        p.atk-=rarity==='legendary'?8:rarity==='epic'?6:rarity==='rare'?4:2;
    }
    if(type==='armor'){
        p.def-=rarity==='legendary'?8:rarity==='epic'?6:rarity==='rare'?4:2;
    }
    if(type==='artifact'){
        if(rarity==='legendary'){cooldownBase[0]+=4;p.maxHp-=40;p.maxEnergy-=20;}
        else if(rarity==='epic'){cooldownBase[0]+=3;p.maxHp-=30;p.maxEnergy-=15;}
        else if(rarity==='rare'){cooldownBase[0]+=2;p.maxHp-=20;p.maxEnergy-=10;}
        else {cooldownBase[0]+=1;p.maxHp-=10;p.maxEnergy-=5;}
        p.hp=Math.min(p.hp,p.maxHp);
        p.energy=Math.min(p.energy,p.maxEnergy);
    }
    populateCustom();
    updateCoins();
    updateEquipInfo();
    updateLoadout();
    updateUI();
}

function goBack(){
    document.getElementById('loadout-screen').classList.add('hidden');
    document.getElementById('custom-screen').classList.add('hidden');
    document.getElementById('battle-screen').classList.add('hidden');
    document.getElementById('victory-screen').classList.add('hidden');
    document.getElementById('defeat-screen').classList.add('hidden');
    document.getElementById('selection-screen').classList.remove('hidden');
    hideBack();
}

function startCampaign(){
    if(!monstersLoaded){
        alert('Monsters are still spawning. Please try again.');
        return;
    }
    if(!isCampaign){
        campaignLevel=1;
    }else if(lastBattleWon){
        campaignLevel++;
    }
    isCampaign=true;
    lastBattleWon=false;
    battleNumber=1;
    startBattle();
}

function startBossBattle(){
    isBoss=true;
    startBattle();
}

function showConfetti(){
    for(let i=0;i<30;i++){
        const span=document.createElement('span');
        span.className='confetti';
        span.textContent='🎉';
        span.style.left=Math.random()*100+'vw';
        span.style.animationDelay=Math.random()*0.5+'s';
        document.body.appendChild(span);
        setTimeout(()=>span.remove(),1000);
    }
}

function previewItem(type){
    if(!itemsLoaded) return;
    const {name,rarity}=shopStock[type];
    nextPurchase[type]={name,rarity};
    document.getElementById(`buy-${type}-btn`).title=name;
    const rarityLabel=rarity.charAt(0).toUpperCase()+rarity.slice(1);
    document.getElementById('preview').innerHTML=colorName(`${name} (${rarityLabel})`,rarity);
}

function clearPreview(e){
    const id=e.currentTarget.id;
    const type=id.split('-')[1];
    nextPurchase[type]=null;
    e.currentTarget.removeAttribute('title');
    document.getElementById('preview').textContent='';
}

function playerAttack(){
    if(current!==0) return;
    attack();
}

function playerDefend(){
    if(current!==0) return;
    defend();
}

function playerSpecial(){
    if(current!==0) return;
    special();
}

document.getElementById('attack-btn').onclick=playerAttack;
document.getElementById('defend-btn').onclick=playerDefend;
document.getElementById('special-btn').onclick=playerSpecial;
document.getElementById('start-btn').onclick=startCampaign;
document.getElementById('next-btn').onclick=nextBattle;
document.getElementById('shop-btn').onclick=()=>{
    document.getElementById('shop-screen').classList.toggle('hidden');
};
document.getElementById('boss-btn').onclick=startBossBattle;
document.getElementById('custom-btn').onclick=showCustom;
document.getElementById('custom-back').onclick=hideCustom;
document.getElementById('equip-sel-weapon').onclick=()=>equipSelected('weapon');
document.getElementById('equip-sel-armor').onclick=()=>equipSelected('armor');
document.getElementById('equip-sel-artifact').onclick=()=>equipSelected('artifact');
document.getElementById('intro-play').onclick=()=>{
    document.getElementById('intro-screen').classList.add('hidden');
    document.getElementById('selection-screen').classList.remove('hidden');
    history.pushState({screen:'selection'}, "");
};
document.getElementById('buy-weapon-btn').addEventListener('mouseenter',()=>previewItem('weapon'));
document.getElementById('buy-weapon-btn').addEventListener('mouseleave',clearPreview);
document.getElementById('buy-armor-btn').addEventListener('mouseenter',()=>previewItem('armor'));
document.getElementById('buy-armor-btn').addEventListener('mouseleave',clearPreview);
document.getElementById('buy-artifact-btn').addEventListener('mouseenter',()=>previewItem('artifact'));
document.getElementById('buy-artifact-btn').addEventListener('mouseleave',clearPreview);

// Initialize history and handle browser back
history.replaceState({screen:"intro"}, "");
window.addEventListener("popstate", (e)=>{
    if(e.state && e.state.screen === 'intro'){
        document.getElementById('intro-screen').classList.remove('hidden');
        document.getElementById('selection-screen').classList.add('hidden');
    }else{
        goBack();
    }
});