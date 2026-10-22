import { CoreMapView } from './Controls/Base/coreMapView.js';
import { Textures } from './texture.js';

/**
 * Scène de démonstration : prairie, étangs, chemins, cottage, plateforme,
 * une habitation à plusieurs étages au sud, et des habitants.
 *
 * Tout passe par l'API publique de la carte : c'est le mode d'emploi d'un
 * futur éditeur.
 *
 * location (0,0) est le coin HAUT-GAUCHE de l'écran ; le champ s'ouvre vers
 * la droite et vers le bas. L'habitation est plus bas sur y : il faut
 * marcher ou panser pour y entrer.
 */
export class DemoWorld{

    #width = 40;
    #height = 40;
    #depth = 8;

    get width(){ return this.#width; }
    get height(){ return this.#height; }
    get depth(){ return this.#depth; }

    textures(){
        Textures.image("herbe", "./Images/herbe.png");
        Textures.color("eau",      "#2e7dd7");
        Textures.color("sable",    "#d9c07a");
        Textures.color("pierre",   "#9aa0a6");
        Textures.color("bois",     "#8d6e4a");
        Textures.color("crepi",    "#cfc6b8");
        Textures.color("plancher", "#c4a574");
        Textures.color("toit",     "#a8352c");
        Textures.color("ardoise",  "#5c6570");
        Textures.color("vide",     "#39423a");
        Textures.color("heros",    "#ffca28");
        Textures.color("villageois","#7e57c2");
        Textures.color("arbre",    "#2e7d32");
        Textures.color("buisson",  "#3d7a3a");
        Textures.color("baril",    "#8b4513");
        Textures.color("caisse",   "#b08968");
        Textures.color("rocher",   "#6d7378");
    }

    createWorldMap(){
        const worldMap = CoreMapView.FactoryWorld.createWorldMap(this.#width, this.#height, this.#depth, {name:"démo"});

        worldMap.fillFloor(0, { walkable:true, floors:["herbe"] });
        this.pond(worldMap);
        this.pondSouth(worldMap);
        this.path(worldMap);
        this.platform(worldMap);
        this.cottage(worldMap);
        this.habitation(worldMap);
        this.garden(worldMap);
        this.trees(worldMap);
        this.props(worldMap);
        this.people(worldMap);

        return worldMap;
    }

    pond(worldMap){
        for(let x = 1; x <= 5; x++)
            for(let y = 0; y <= 4; y++)
                worldMap.setCube(x, y, 0, { walkable:false, floors:["eau"] });
    }

    /** Un second plan d'eau, plus à l'est. */
    pondSouth(worldMap){
        for(let x = 22; x <= 26; x++)
            for(let y = 10; y <= 14; y++)
                worldMap.setCube(x, y, 0, { walkable:false, floors:["eau"] });
    }

    /** Chemin de sable : cottage → sud, puis contour est jusqu'à la porte. */
    path(worldMap){
        for(let x = 6; x <= 14; x++)
            worldMap.setCube(x, 5, 0, { walkable:true, floors:["sable"] });
        for(let y = 6; y <= 24; y++)
            worldMap.setCube(14, y, 0, { walkable:true, floors:["sable"] });
        for(let y = 24; y <= 34; y++)
            worldMap.setCube(19, y, 0, { walkable:true, floors:["sable"] });
        for(let x = 14; x <= 19; x++)
            worldMap.setCube(x, 34, 0, { walkable:true, floors:["sable"] });
    }

    platform(worldMap){
        for(let x = 7; x <= 10; x++)
            for(let y = 6; y <= 8; y++){
                worldMap.setCube(x, y, 0, { walkable:false, volumes:["pierre"] });
                worldMap.setCube(x, y, 1, { walkable:true,  floors:["pierre"] });
            }
    }

    /**
     * Cottage d'un étage près de la caméra : toit escamotable via une Room.
     */
    cottage(worldMap){
        const left = 12, top = 0, right = 16, bottom = 4;
        this.#box(worldMap, left, top, right, bottom, 0, {
            wall: "bois", floor: "plancher", doorX: 14, doorY: bottom
        });
        this.#roof(worldMap, left, top, right, bottom, 1, "toit");
        worldMap.addRoom(left, top, 0, right - left + 1, bottom - top + 1, 1);
    }

    /**
     * Habitation de trois étages au sud. Une Room par niveau : on ne masque
     * que ce qui est au-dessus de l'étage occupé. L'escalier est une colonne
     * de cubes walkable (même x,y, z croissant) : le pathfinding autorise (0,0,1).
     */
    habitation(worldMap){
        const left = 10, top = 25, right = 18, bottom = 33;
        const stairX = 12, stairY = 27;
        const width = right - left + 1;
        const height = bottom - top + 1;

        this.#box(worldMap, left, top, right, bottom, 0, {
            wall: "crepi", floor: "plancher", doorX: 14, doorY: bottom
        });
        this.#box(worldMap, left, top, right, bottom, 1, {
            wall: "crepi", floor: "plancher"
        });
        this.#box(worldMap, left, top, right, bottom, 2, {
            wall: "crepi", floor: "plancher"
        });
        this.#roof(worldMap, left, top, right, bottom, 3, "ardoise");

        for(let z = 0; z <= 2; z++)
            worldMap.setCube(stairX, stairY, z, { walkable:true, floors:["pierre"] });

        worldMap.addRoom(left, top, 0, width, height, 1);
        worldMap.addRoom(left, top, 1, width, height, 1);
        worldMap.addRoom(left, top, 2, width, height, 1);
    }

    /** Haie et quelques buissons le long de l'habitation. */
    garden(worldMap){
        for(let y = 25; y <= 33; y++)
            worldMap.setCube(8, y, 0, { walkable:false, volumes:["bois"] });
        for(let x = 8; x <= 18; x++)
            worldMap.setCube(x, 35, 0, { walkable:false, volumes:["bois"] });
    }

    trees(worldMap){
        const spots = [
            [0,0],[2,4],[4,6],[6,8],[11,4],[20,3],[24,6],
            [3,12],[6,16],[20,18],[24,22],[28,8],[30,14],
            [7,28],[20,30],[22,34],[28,26],[32,32]
        ];
        for(let i = 0; i < spots.length; i++)
            worldMap.spawn(spots[i][0], spots[i][1], 0, {
                id: "arbre" + i, sprite:"arbre", width:1, height:3, canTarget:true
            });
    }

    props(worldMap){
        worldMap.spawn(6, 4, 0,  { id:"baril1",  sprite:"baril",  width:1, height:1, canTarget:true });
        worldMap.spawn(15, 6, 0, { id:"baril2",  sprite:"baril",  width:1, height:1, canTarget:true });
        worldMap.spawn(16, 23, 0,{ id:"caisse1", sprite:"caisse", width:1, height:1, canTarget:true });
        worldMap.spawn(17, 24, 0,{ id:"caisse2", sprite:"caisse", width:1, height:1, canTarget:true });
        worldMap.spawn(21, 12, 0,{ id:"rocher1", sprite:"rocher", width:1, height:1, canTarget:true });
        worldMap.spawn(4, 20, 0, { id:"rocher2", sprite:"rocher", width:1, height:1, canTarget:true });
        worldMap.spawn(9, 26, 0, { id:"buisson1",sprite:"buisson",width:1, height:1, canTarget:true });
        worldMap.spawn(19, 32, 0,{ id:"buisson2",sprite:"buisson",width:1, height:1, canTarget:true });
        worldMap.spawn(11, 34, 0,{ id:"buisson3",sprite:"buisson",width:1, height:1, canTarget:true });
    }

    people(worldMap){
        worldMap.spawnPlayer(20, 20, 0, { id:"heros",       sprite:"heros",      width:1, height:2, canMove:true, canTarget:true });
        worldMap.spawn(14, 2, 0,  { id:"villageois",  sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        worldMap.spawn(8,  7, 1,  { id:"guetteur",    sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        worldMap.spawn(2,  3, 0,  { id:"pecheur",     sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        worldMap.spawn(23, 16, 0, { id:"promeneur",   sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        worldMap.spawn(13, 29, 0, { id:"aubergiste",  sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        worldMap.spawn(16, 28, 1, { id:"etage",       sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        worldMap.spawn(14, 30, 2, { id:"combles",     sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
    }

    /**
     * Murs sur le périmètre, sol walkable à l'intérieur.
     * doorX/doorY : ouverture walkable (rez-de-chaussée).
     */
    #box(worldMap, left, top, right, bottom, z, options){
        const wall = options.wall;
        const floor = options.floor;
        const doorX = options.doorX;
        const doorY = options.doorY;
        for(let x = left; x <= right; x++)
            for(let y = top; y <= bottom; y++){
                const onWall = (x === left || x === right || y === top || y === bottom);
                const door = (doorX != null && x === doorX && y === doorY);
                if(onWall && !door)
                    worldMap.setCube(x, y, z, { walkable:false, volumes:[wall] });
                else
                    worldMap.setCube(x, y, z, { walkable:true, floors:[floor] });
            }
    }

    #roof(worldMap, left, top, right, bottom, z, name){
        for(let x = left; x <= right; x++)
            for(let y = top; y <= bottom; y++)
                worldMap.setCube(x, y, z, { walkable:false, floors:[name] });
    }
}
