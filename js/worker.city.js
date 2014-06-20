'use strict';
var transMessage = self.webkitPostMessage || self.postMessage;

var CITY = {};
var timer;
var timestep = 1000/30;
var Game;
var pcount = 0;
var power;

//var ab = new ArrayBuffer( 1 );
//transMessage( ab, [ab] );
var trans = false;// ( ab.byteLength === 0 );

self.onmessage = function (e) {
	var p = e.data.tell;
	if( p == "INIT" ) Game = new CITY.Game(e.data.url);//init(e.data.url);   
    if( p == "NEWMAP" ) Game.newMap(); 
    if( p == "PLAYMAP" ) Game.playMap();
    if( p == "TOOL" ) Game.tool(e.data.name);
    if( p == "MAPCLICK" ) Game.mapClick(e.data.x, e.data.y);
    if( p == "RUN" && trans) updateTrans(e.data);
};

var updateTrans = function(data){
    if (!Game.isPaused){
        Game.simulation.needPower = [];
        Game.simulation.simFrame();
        Game.simulation.updateFrontEnd();

        Game.processMessages(Game.simulation.messageManager.getMessages());
        Game.simulation.spriteManager.moveObjects();
    }
    //Game.getTiles();
    //Game.animatedTiles();
    Game.calculateSprites();
    //sprite = calculateSpritesForPaint();
    //gameCanvas.paint(mouse, sprite, isPaused);
    //transMessage({ tell:"RUN", infos:Game.infos, sprites:Game.map.genFull() });
    //transMessage({ tell:"RUN", infos:Game.infos, tiles:Game.tilesData, anims:Game.animsData, sprites:Game.spritesData});
    var tilesData = data.tilesData;
    var i = tilesData.length;
    while(i--){tilesData[i] = Game.map.tilesData[i];}

    transMessage({ tell:"RUN", infos:Game.infos, tilesData:tilesData, anims:Game.animsData, sprites:Game.spritesData}, [tilesData.buffer]);
};

var update = function(){
    power = null;
    if (!Game.isPaused){
        pcount++;
        //Game.simulation.needPower = [];
        Game.simulation.simFrame();
        Game.simulation.updateFrontEnd();

        Game.processMessages(Game.simulation.messageManager.getMessages());
        Game.simulation.spriteManager.moveObjects();
        if(pcount==30){
            pcount = 0;
            power = Game.map.powerData;
            //power = Game.simulation.needPower;
        }
    }
    //Game.getTiles();
    //Game.animatedTiles();
    Game.calculateSprites();
    //sprite = calculateSpritesForPaint();
    //gameCanvas.paint(mouse, sprite, isPaused);
    //transMessage({ tell:"RUN", infos:Game.infos, sprites:Game.map.genFull() });
    //transMessage({ tell:"RUN", infos:Game.infos, tiles:Game.tilesData, anims:Game.animsData, sprites:Game.spritesData});
    //var tilesData = Game.map.tilesData;

    transMessage({ tell:"RUN", infos:Game.infos, tilesData:Game.map.tilesData, powerData:power, sprites:Game.spritesData});
};

CITY.Game = function(url) {
    importScripts(url);

    this.mapSize = [128,128];
    this.difficulty = 2;
    this.speed = 2;
    this.mapGen = new Micro.generateMap();

    this.simulation = null;
    this.gameTools = null;
    this.animationManager = null;
    this.map = null;

    this.isPaused = false;
    this.simNeededBudget = false;
    this.currentTool = null;
    this.timer = null;
    this.infos = [];
    this.sprites = [];

    this.spritesData = null;
    this.animsData = null;
    this.tilesData = null;

    this.spritesData  = [];

    //this.needMapUpdate = false;


    this.newMap();
};

CITY.Game.prototype = {
    constructor: CITY.Game,
    newMap : function(){
        this.map = this.mapGen.construct(this.mapSize[0], this.mapSize[1]);
        transMessage({ tell:"NEWMAP", tilesData:this.map.tilesData, mapSize:this.mapSize, island:this.map.isIsland, trans:trans });
    },
    playMap : function(){
        var money = 20000 / this.difficulty; 
        this.gameTools = new Micro.GameTools(this.map);
        this.animationManager = new Micro.AnimationManager(this.map);
        this.simulation = new Micro.Simulation( this.map, this.difficulty, this.speed, true);

        // intro message
        var messageMgr = new Micro.MessageManager();
        messageMgr.sendMessage(Messages.WELCOME);
        this.simulation.budget.setFunds(money);
        messageMgr.sendMessage(Messages.FUNDS_CHANGED, money);
        this.processMessages(messageMgr.getMessages());

        // update simulation time
        if(!trans) timer = setInterval(update, timestep);
        else update();
    },
    changeSpeed :function(n){
        // 0:pause  1:slow  2:medium  3:fast
        this.speed = n;
        if(this.speed === 0) this.isPaused = true;
        else this.isPaused = false;
        this.simulation.setSpeed(this.speed);
    },
    changeDifficulty:function(n){
        // 0: easy  1: medium  2: hard
        this.difficulty = n;
        this.simulation.setDifficulty ( this.difficulty );
    },
    animatedTiles : function() {
        var animTiles = this.animationManager.getTiles(0, 0, this.mapSize[0] + 1, this.mapSize[1] + 1, this.isPaused);
        var i = animTiles.length;
        this.animsData = new M_ARRAY_TYPE(i); 
        while(i--){
            var tile = animTiles[i];
            this.animsData[i] = [tile.tileValue, tile.x, tile.y];
        }
    },
    calculateSprites : function() {
        this.sprites = this.simulation.spriteManager.getSpritesInView(0, 0, this.mapSize[0] + 1, this.mapSize[1] + 1);
        var i = this.sprites.length;
        //this.spritesData = new M_ARRAY_TYPE(i);
        while(i--){
            var sprite = this.sprites[i];
            this.spritesData[i] = [sprite.type, sprite.frame, sprite.x || 0, sprite.y || 0];
        }
    },
    processMessages : function(messages) {
        var messageOutput = false;

        for (var i = 0, l = messages.length; i < l; i++) {
            var m = messages[i];
            switch (m.message) {
                case Messages.BUDGET_NEEDED: this.simNeededBudget = true; this.handleBudgetRequest(); break;
               // case Messages.QUERY_WINDOW_NEEDED: this.queryWindow.open(this.handleQueryClosed.bind(this)); break;
                case Messages.DATE_UPDATED: this.infos[0] = [TXT.months[ m.data.month ], m.data.year].join(' '); break;
                case Messages.EVAL_UPDATED: this.infos[1] = '| ' + TXT.cityClass[m.data.classification]; this.infos[2] = ' | score:' + m.data.score; this.infos[3] = '<br>population:' + m.data.population; break;
                case Messages.FUNDS_CHANGED: this.infos[4] = '| money:'+m.data+'$'; break;
                case Messages.VALVES_UPDATED: this.infos[5] = '<br>RCI: ' + m.data.residential; this.infos[6] = ' | ' + m.data.commercial; this.infos[7] = ' | ' + m.data.industrial; break;
                default: 
                    if (!messageOutput && TXT.goodMessages[m.message] !== undefined) { 
                        this.infos[8] = '<br>' + TXT.goodMessages[m.message]; 
                        break;
                    }
                    if (!messageOutput && TXT.badMessages[m.message] !== undefined) {
                        messageOutput = true;
                        this.infos[8] = '<br>' + TXT.badMessages[m.message];
                        break;
                    }
                    if (!messageOutput && TXT.neutralMessages[m.message] !== undefined) {
                        messageOutput = true;
                        this.infos[8] = '<br>' + TXT.neutralMessages[m.message] ;
                        break;
                    }
            }
        }
    },
    tool : function(name){
        if(this.currentTool!==null) this.currentTool.clear();
        if(name !== "none") this.currentTool = this.gameTools[name];
        else this.currentTool = null;
    },
    mapClick : function(x,y){
        if(this.currentTool!==null){
            var budget = this.simulation.budget;
            var evaluation = this.simulation.evaluation;
            var messageMgr = new Micro.MessageManager();
            this.currentTool.doTool(x, y, messageMgr, this.simulation.blockMaps );
            this.currentTool.modifyIfEnoughFunding(budget, messageMgr);
            var tell = "";   
            switch (this.currentTool.result) {
                case this.currentTool.TOOLRESULT_NEEDS_BULLDOZE: tell = TXT.toolMessages.needsDoze; break;
                case this.currentTool.TOOLRESULT_NO_MONEY: tell = TXT.toolMessages.noMoney; break; 
                default: 
                    tell = '&nbsp;';
                    //if( id >= 11  && id != 15 ) this.needMapUpdate = true;
                    transMessage({tell:"BUILD", x:x, y:y });  
                break;
            }
            this.processMessages(messageMgr.getMessages());
        }
    },
    handleBudgetRequest : function() {
        this.budgetShowing = true;

        var budgetData = {
            roadFund: this.simulation.budget.roadFund,
            roadRate: Math.floor(this.simulation.budget.roadPercent * 100),
            fireFund: this.simulation.budget.fireFund,
            fireRate: Math.floor(this.simulation.budget.firePercent * 100),
            policeFund: this.simulation.budget.policeFund,
            policeRate: Math.floor(this.simulation.budget.policePercent * 100),
            taxRate: this.simulation.budget.cityTax,
            totalFunds: this.simulation.budget.totalFunds,
            taxesCollected: this.simulation.budget.taxFund
        };

        if (this.simNeededBudget) {
            this.simulation.budget.doBudget(this.simulation.messageManager);
            this.simNeededBudget = false;
        } else {
            this.simulation.budget.updateFundEffects();
        }

        
        //this.budgetWindow.open(this.handleBudgetClosed.bind(this), budgetData);
        // Let the input know we handled this request
        //this.inputStatus.budgetHandled();
    }
};