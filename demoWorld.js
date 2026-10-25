import { CoreMapView } from './Controls/Base/coreMapView.js';
import { Cube } from './cube.js';
import { Entity } from './entity.js';
import { Room } from './room.js';
import { Textures } from './texture.js';
import { WorldMap } from './worldMap.js';

/**
 * Scène de démonstration : prairie, étangs, chemins, cottage, plateforme,
 * une habitation à plusieurs étages au sud, une colline, et des habitants.
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
        const worldMap = CoreMapView.FactoryWorld.create({
            type: WorldMap.type, name: "démo",
            width: this.#width, height: this.#height, depth: this.#depth
        });

        for(let x = 0; x < this.#width; x++)
            for(let y = 0; y < this.#height; y++)
                this.#put(worldMap, x, y, 0, { walkable:true, floors:["herbe"] });
        this.pond(worldMap);
        this.pondSouth(worldMap);
        this.path(worldMap);
        this.platform(worldMap);
        this.cottage(worldMap);
        this.habitation(worldMap);
        this.hill(worldMap);
        this.garden(worldMap);
        this.trees(worldMap);
        this.props(worldMap);
        this.people(worldMap);

        return worldMap;
    }

    pond(worldMap){
        for(let x = 1; x <= 5; x++)
            for(let y = 0; y <= 4; y++)
                this.#put(worldMap, x, y, 0, { walkable:false, floors:["eau"] });
    }

    /** Un second plan d'eau, plus à l'est. */
    pondSouth(worldMap){
        for(let x = 22; x <= 26; x++)
            for(let y = 10; y <= 14; y++)
                this.#put(worldMap, x, y, 0, { walkable:false, floors:["eau"] });
    }

    /** Chemin de sable : cottage → sud, puis contour est jusqu'à la porte. */
    path(worldMap){
        for(let x = 6; x <= 14; x++)
            this.#put(worldMap, x, 5, 0, { walkable:true, floors:["sable"] });
        for(let y = 6; y <= 24; y++)
            this.#put(worldMap, 14, y, 0, { walkable:true, floors:["sable"] });
        for(let y = 24; y <= 34; y++)
            this.#put(worldMap, 19, y, 0, { walkable:true, floors:["sable"] });
        for(let x = 14; x <= 19; x++)
            this.#put(worldMap, x, 34, 0, { walkable:true, floors:["sable"] });
    }

    platform(worldMap){
        for(let x = 7; x <= 10; x++)
            for(let y = 6; y <= 8; y++){
                this.#put(worldMap, x, y, 0, { walkable:false, volumes:["pierre"] });
                this.#put(worldMap, x, y, 1, { walkable:true,  floors:["pierre"] });
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
        worldMap.addRoom(CoreMapView.FactoryWorld.create({
            type: Room.type, id: "cottage", x: left, y: top, z: 0,
            width: right - left + 1, height: bottom - top + 1, depth: 1
        }));
    }

    /**
     * Habitation de trois étages au sud. Un étage fait deux cubes :
     * le plancher, puis le vide jusqu'au plancher suivant.
     * La marche est dehors, au sud de la porte. Dedans, le toit de la
     * diagonale écran la recouvrait, et la Room la masquait avec le plafond.
     * On monte d'un cube vers cette marche, puis d'un cube vers le palier.
     * Une Room par niveau : on ne masque que ce qui est au-dessus de l'étage occupé.
     */
    habitation(worldMap){
        const left = 10, top = 25, right = 18, bottom = 33;
        const width = right - left + 1;
        const height = bottom - top + 1;
        const doorX = 14;
        const stepX = doorX;
        const stepY = bottom + 1;
        const levels = [0, 2, 4];

        for(let i = 0; i < levels.length; i++){
            const z = levels[i];
            this.#box(worldMap, left, top, right, bottom, z, {
                wall: "crepi", floor: "plancher",
                doorX: z === 0 ? doorX : null,
                doorY: z === 0 ? bottom : null,
                landingX: i > 0 ? doorX : null,
                landingY: i > 0 ? bottom : null
            });
            this.#rim(worldMap, left, top, right, bottom, z + 1, "crepi", doorX, bottom);
            if(i < levels.length - 1)
                this.#put(worldMap, stepX, stepY, z + 1, { walkable:true, floors:["pierre"] });
        }
        this.#roof(worldMap, left, top, right, bottom, 6, "ardoise");

        for(let i = 0; i < levels.length; i++)
            worldMap.addRoom(CoreMapView.FactoryWorld.create({
                type: Room.type, id: "habitation" + levels[i],
                x: left, y: top, z: levels[i], width, height, depth: 2
            }));
    }

    /**
     * Colline de cinq cubes de haut, à l'est.
     * Chaque marche est à côté de la précédente : le cube juste au-dessus
     * de la marche qu'on quitte reste vide, pour que la montée reste ouverte.
     */
    hill(worldMap){
        const x0 = 30;
        const y0 = 18;
        for(let row = 0; row < 3; row++){
            for(let h = 1; h <= 5; h++){
                const x = x0 + h - 1;
                const y = y0 + row;
                for(let z = 1; z < h; z++)
                    this.#put(worldMap, x, y, z, { walkable:false, volumes:["pierre"] });
                this.#put(worldMap, x, y, h, { walkable:true, floors:["pierre"] });
            }
        }
    }

    /** Haie et quelques buissons le long de l'habitation. */
    garden(worldMap){
        for(let y = 25; y <= 33; y++)
            this.#put(worldMap, 8, y, 0, { walkable:false, volumes:["bois"] });
        for(let x = 8; x <= 18; x++)
            this.#put(worldMap, x, 35, 0, { walkable:false, volumes:["bois"] });
    }

    trees(worldMap){
        const spots = [
            [0,0],[2,4],[4,6],[6,8],[11,4],[20,3],[24,6],
            [3,12],[6,16],[20,18],[24,22],[28,8],[30,14],
            [7,28],[20,30],[22,34],[28,26],[32,32]
        ];
        for(let i = 0; i < spots.length; i++)
            this.#spawn(worldMap, spots[i][0], spots[i][1], 0, {
                id: "arbre" + i, sprite:"arbre", width:1, height:3, canTarget:true
            });
    }

    props(worldMap){
        this.#spawn(worldMap, 6, 4, 0,  { id:"baril1",  sprite:"baril",  width:1, height:1, canTarget:true });
        this.#spawn(worldMap, 15, 6, 0, { id:"baril2",  sprite:"baril",  width:1, height:1, canTarget:true });
        this.#spawn(worldMap, 16, 23, 0,{ id:"caisse1", sprite:"caisse", width:1, height:1, canTarget:true });
        this.#spawn(worldMap, 17, 24, 0,{ id:"caisse2", sprite:"caisse", width:1, height:1, canTarget:true });
        this.#spawn(worldMap, 21, 12, 0,{ id:"rocher1", sprite:"rocher", width:1, height:1, canTarget:true });
        this.#spawn(worldMap, 4, 20, 0, { id:"rocher2", sprite:"rocher", width:1, height:1, canTarget:true });
        this.#spawn(worldMap, 9, 26, 0, { id:"buisson1",sprite:"buisson",width:1, height:1, canTarget:true });
        this.#spawn(worldMap, 19, 32, 0,{ id:"buisson2",sprite:"buisson",width:1, height:1, canTarget:true });
        this.#spawn(worldMap, 11, 34, 0,{ id:"buisson3",sprite:"buisson",width:1, height:1, canTarget:true });
    }

    people(worldMap){
        this.#spawnPlayer(worldMap, 20, 20, 0, { id:"heros",       sprite:"heros",      width:1, height:2, canMove:true, canTarget:true });
        this.#spawn(worldMap, 14, 2, 0,  { id:"villageois",  sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        this.#spawn(worldMap, 8,  7, 1,  { id:"guetteur",    sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        this.#spawn(worldMap, 2,  3, 0,  { id:"pecheur",     sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        this.#spawn(worldMap, 23, 16, 0, { id:"promeneur",   sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        this.#spawn(worldMap, 13, 29, 0, { id:"aubergiste",  sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        this.#spawn(worldMap, 16, 28, 2, { id:"etage",       sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        this.#spawn(worldMap, 14, 30, 4, { id:"combles",     sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
    }

    /**
     * Murs sur le périmètre, sol walkable à l'intérieur.
     * doorX/doorY : ouverture walkable (rez-de-chaussée).
     * landingX/landingY : le mur devient un palier, pour entrer depuis la marche.
     */
    #box(worldMap, left, top, right, bottom, z, options){
        const wall = options.wall;
        const floor = options.floor;
        const doorX = options.doorX;
        const doorY = options.doorY;
        const landingX = options.landingX;
        const landingY = options.landingY;
        for(let x = left; x <= right; x++)
            for(let y = top; y <= bottom; y++){
                const onWall = (x === left || x === right || y === top || y === bottom);
                const door = (doorX != null && x === doorX && y === doorY);
                const landing = (landingX != null && x === landingX && y === landingY);
                if(onWall && !door && !landing)
                    this.#put(worldMap, x, y, z, { walkable:false, volumes:[wall] });
                else
                    this.#put(worldMap, x, y, z, { walkable:true, floors:[floor] });
            }
    }

    /**
     * Second cube d'un étage : seulement les murs, le vide intérieur reste ouvert.
     * openX/openY : pas de linteau, le cube au-dessus de la porte reste vide
     * pour que la montée vers la marche ne bute pas sur un plancher fermé.
     */
    #rim(worldMap, left, top, right, bottom, z, wall, openX, openY){
        for(let x = left; x <= right; x++)
            for(let y = top; y <= bottom; y++){
                const onWall = (x === left || x === right || y === top || y === bottom);
                if(onWall && !(x === openX && y === openY))
                    this.#put(worldMap, x, y, z, { walkable:false, volumes:[wall] });
            }
    }

    #roof(worldMap, left, top, right, bottom, z, name){
        for(let x = left; x <= right; x++)
            for(let y = top; y <= bottom; y++)
                this.#put(worldMap, x, y, z, { walkable:false, floors:[name] });
    }

    /**
     * Pose un cube. Tout cube au sol (z = 0), et toute surface de plancher,
     * a floorOpen fermé : on ne tombe pas à travers.
     */
    #put(worldMap, x, y, z, options){
        const cube = { ...options, x, y, z, type: Cube.type };
        if(z === 0 || options.floors != null) cube.floorOpen = false;
        worldMap.addCube(CoreMapView.FactoryWorld.create(cube));
    }

    /** Crée un PNJ ou un objet et le donne à la carte. */
    #spawn(worldMap, x, y, z, options){
        worldMap.addEntity(CoreMapView.FactoryWorld.create({...options, x, y, z, type: options.type ?? Entity.type}));
    }

    /** Crée le joueur et le donne à la carte. */
    #spawnPlayer(worldMap, x, y, z, options){
        worldMap.addPlayer(CoreMapView.FactoryWorld.create({...options, x, y, z, type: options.type ?? Entity.type}));
    }
}
