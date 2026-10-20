import { CoreMapView } from './Controls/Base/coreMapView.js';
import { Textures } from './texture.js';

/**
 * Une petite scène de démonstration : de l'herbe, un étang, un chemin, une
 * maison au toit escamotable, une plateforme de pierre et quelques habitants.
 *
 * Elle sert aussi de mode d'emploi : tout ce qui suit n'utilise que l'API
 * publique de la carte, donc c'est exactement ce qu'un éditeur aura à écrire.
 *
 * Le décor tient volontairement dans le triangle visible par la caméra placée
 * en (0,0) : dans cette vue, location désigne le coin HAUT-GAUCHE de l'écran,
 * et le champ de vision s'ouvre vers la droite et vers le bas.
 */
export class DemoWorld{

    #width = 24;
    #height = 24;
    #depth = 6;

    get width(){ return this.#width; }
    get height(){ return this.#height; }
    get depth(){ return this.#depth; }

    /**
     * Déclare l'habillage. Une texture est soit une image, soit une couleur :
     * les couleurs permettent de bâtir un monde entier sans aucun dessin.
     */
    textures(){
        Textures.image("herbe", "./Images/herbe.png");
        Textures.color("eau",    "#2e7dd7");
        Textures.color("sable",  "#d9c07a");
        Textures.color("pierre", "#9aa0a6");
        Textures.color("bois",   "#8d6e4a");
        Textures.color("toit",   "#a8352c");
        Textures.color("vide",   "#39423a");
        Textures.color("heros",  "#ffca28");
        Textures.color("villageois", "#7e57c2");
        Textures.color("arbre",  "#2e7d32");
    }

    /** Construit et renvoie la carte complète. */
    createWorldMap(){
        const worldMap = CoreMapView.FactoryWorld.createWorldMap(this.#width, this.#height, this.#depth, {name:"démo"});

        worldMap.fillFloor(0, { walkable:true, floors:["herbe"] });
        this.pond(worldMap);
        this.path(worldMap);
        this.platform(worldMap);
        this.house(worldMap);
        this.trees(worldMap);
        this.people(worldMap);

        return worldMap;
    }

    /** De l'eau : un sol qu'on voit mais qu'on ne traverse pas (walkable à faux). */
    pond(worldMap){
        for(let x = 1; x <= 4; x++)
            for(let y = 0; y <= 3; y++)
                worldMap.setCube(x, y, 0, { walkable:false, floors:["eau"] });
    }

    /** Un chemin de sable qui relie la maison à la plateforme. */
    path(worldMap){
        for(let x = 6; x <= 14; x++)
            worldMap.setCube(x, 5, 0, { walkable:true, floors:["sable"] });
    }

    /**
     * Une plateforme d'un étage : du plein en dessous, un sol praticable dessus.
     * On peut y monter sans escalier parce que le déplacement autorise les
     * diagonales en altitude d'un cube de haut.
     */
    platform(worldMap){
        for(let x = 7; x <= 10; x++)
            for(let y = 6; y <= 8; y++){
                worldMap.setCube(x, y, 0, { walkable:false, volumes:["pierre"] });
                worldMap.setCube(x, y, 1, { walkable:true,  floors:["pierre"] });
            }
    }

    /**
     * Une maison : quatre murs percés d'une porte, un toit un étage plus haut.
     * La zone sans plafond déclarée à la fin fera disparaître ce toit dès qu'un
     * personnage sélectionné se trouvera à l'intérieur.
     */
    house(worldMap){
        const left = 12, top = 0, right = 16, bottom = 4;

        for(let x = left; x <= right; x++)
            for(let y = top; y <= bottom; y++){
                const wall = (x == left || x == right || y == top || y == bottom);
                const door = (x == 14 && y == bottom);
                if(wall && !door) worldMap.setCube(x, y, 0, { walkable:false, volumes:["bois"] });
                worldMap.setCube(x, y, 1, { walkable:false, floors:["toit"] });
            }

        worldMap.addNoCeilingZone(left, top, 0, right - left, bottom - top, 2);
    }

    trees(worldMap){
        const spots = [[0,0],[2,4],[4,6],[6,8],[11,4],[14,6]];
        for(let i = 0; i < spots.length; i++)
            worldMap.spawn(spots[i][0], spots[i][1], 0, {
                id: "arbre" + i, sprite:"arbre", width:1, height:3, canTarget:true
            });
    }

    people(worldMap){
        worldMap.spawnPlayer(10, 5, 0, { id:"heros",      sprite:"heros",      width:1, height:2, canMove:true, canTarget:true });
        worldMap.spawn(14, 2, 0, { id:"villageois", sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
        worldMap.spawn(8,  7, 1, { id:"guetteur",   sprite:"villageois", width:1, height:2, canMove:true, canTarget:true });
    }
}
