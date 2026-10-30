import { CoreMapView } from './Controls/Base/coreMapView.js';
import { Point, Location } from './point.js';
import { EntityMove, Direction } from './entityMove.js';

/**
 * Modèle monde d'un personnage / objet.
 * Distinct de EntityDraw (sprite à l'écran) et de Cube (voxel de terrain).
 *
 * Position (x,y,z) : coin supérieur-droit-arrière du volume.
 * Le volume va vers x/y décroissants et z croissant : base width×width, hauteur height.
 *
 * Le constructeur reçoit un objet options (x, y, z, id, canMove, sprite…).
 * 
 * info pour la documentation :
 * - Si this.canMove = true, EntityMove est créé et initialisé avec un constructeur vide.
 * - Si this.canMove = false, EntityMove est détruit et mis à null.
*/
export class Entity{

    static type = "Entity";
    static version = 1;

    #id = "";
    #location = new Location(); // position dans le monde voxel
    #adjustment = new Point(); // offset dans la case, en % de sizeCase (0..100)
    #width = 1;
    #height = 1;
    #direction = Direction.NONE;
    #canMove = false;
    #canTarget = false;
    #walkable = false;         // d'autres entités peuvent traverser ce volume
    #worldMap = null;          // carte d'appartenance (pathfinding, collisions)
    #entityMove = null;
    #sprite = null;            // sprite / animation courante
    #spriteStand = null;       // sprite idle, repris quand l'anim se termine
    #spriteAnimated = false;

    constructor(options = {}){
        this.fromJSON(options);
    }

    get id(){ return this.#id; }
    set id(value){ this.#id = value; }
    /** La position dans le monde. x, y et z en sont les raccourcis de lecture. */
    get location(){ return this.#location; }
    get adjustment(){ return this.#adjustment; }
    get x(){ return this.#location.x; }
    set x(value){ this.#location.x = value; }
    get y(){ return this.#location.y; }
    set y(value){ this.#location.y = value; }
    get z(){ return this.#location.z; }
    set z(value){ this.#location.z = value; }
    get width(){ return this.#width; }
    set width(value){ this.#width = value; }
    get height(){ return this.#height; }
    set height(value){ this.#height = value; }
    get direction(){ return this.#direction; }
    set direction(value){ this.#direction = value; }
    get canMove(){ return this.#canMove; }
    set canMove(value){ this.#canMove = this.#setCanMove(value); }
    get canTarget(){ return this.#canTarget; }
    set canTarget(value){ this.#canTarget = value; }
    get walkable(){ return this.#walkable; }
    set walkable(value){ this.#walkable = value; }
    get worldMap(){ return this.#worldMap; }
    set worldMap(value){ this.#worldMap = value; }
    get entityMove(){ return this.#entityMove; }
    //set entityMove(value){ this.#entityMove = value ?? null; }
    get sprite(){ return this.#sprite; }
    set sprite(value){ this.#sprite = value; }
    get spriteStand(){ return this.#spriteStand; }
    set spriteStand(value){ this.#spriteStand = value; }
    get spriteAnimated(){ return this.#spriteAnimated; }
    set spriteAnimated(value){ this.#spriteAnimated = value; }

    #setCanMove(value){
        value ? this.#entityMove = CoreMapView.FactoryWorld.create({ type: EntityMove.type }) : this.#entityMove = null;
        return value;
    }

    /** L'entité est-elle en train de parcourir un trajet ? */
    walking(){ return this.entityMove !== null && this.entityMove.walking(); }

    /**
     * Du temps a passé. Aujourd'hui : le déplacement (délégué à EntityMove).
     * Plus tard : dégâts, événements, IA — toujours ici, jamais dans la vue.
     * Renvoie true si la case logique a changé.
     */
    tick(elapsed){
        if(this.entityMove === null) return false;
        const changed = this.entityMove.progress(elapsed, this);
        if(!this.walking()) this.spriteAnimated = false;
        return changed;
    }

    /**
     * Le pas en cours, ou null à l'arrêt.
     * C'est ce que la vue utilise pour placer le sprite entre deux cases.
     */
    stride(){ return this.entityMove === null ? null : this.entityMove.stride(); }

    /** Interrompt le trajet : on se pose et on range le carnet. */
    stop(){
        if(this.entityMove === null) return;
        this.location.copy(this.entityMove.destination);
        this.entityMove.clear();
        this.spriteAnimated = false;
    }

    /** Lance l'entité sur un trajet déjà calculé, depuis le début. */
    walk(path){
        if(this.entityMove === null || !this.entityMove.start(path)) return false;
        this.spriteAnimated = true;
        return true;
    }

    /**
     * Collision point ↔ volume 3D.
     * Utilisé pour savoir si un clic / un cube vise cette entité.
     */
    contains(wx, wy, wz){
        const location = this.location;
        return (wx <= location.x) && (wx > location.x - this.width)
            && (wy <= location.y) && (wy > location.y - this.width)
            && (wz >= location.z) && (wz < location.z + this.height);
    }

    /**
     * Écrit dans l'objet json. Un héritier appelle super.toJSON(json) puis ajoute
     * ses champs. type/version : classe réelle (this.constructor).
     * worldMap est omis : c'est la carte qui contient l'entité, pas l'inverse.
     */
    toJSON(json){
        if(json == null || typeof json !== "object" || Array.isArray(json)) json = {};
        json.type = this.constructor.type;
        json.version = this.constructor.version;
        json.id = this.id;
        json.x = this.location.x;
        json.y = this.location.y;
        json.z = this.location.z;
        json.width = this.width;
        json.height = this.height;
        json.adjustment = this.adjustment.toJSON();
        json.direction = this.direction;
        json.canMove = this.canMove;
        json.canTarget = this.canTarget;
        json.walkable = this.walkable;
        json.sprite = this.sprite;
        json.spriteStand = this.spriteStand;
        json.spriteAnimated = this.spriteAnimated;
        json.entityMove = this.canMove ? this.entityMove.toJSON() : null;
        return json;
    }

    /**
     * Lit le JSON dans cette instance. Un héritier appelle super.fromJSON(json)
     * puis ses champs.
     */
    fromJSON(json){
        if( json.id !== undefined ) this.id = json.id;
        if( json.x !== undefined ) this.location.x = json.x;
        if( json.y !== undefined ) this.location.y = json.y;
        if( json.z !== undefined ) this.location.z = json.z;
        if( json.width !== undefined ) this.width = json.width;
        if( json.height !== undefined ) this.height = json.height;
        if( json.adjustment !== undefined ) this.adjustment.fromJSON(json.adjustment);
        if( json.direction !== undefined ) this.direction = json.direction;
        if( json.canMove !== undefined ) this.canMove = json.canMove;
        if( json.canTarget !== undefined ) this.canTarget = json.canTarget;
        if( json.walkable !== undefined ) this.walkable = json.walkable;
        if( json.sprite !== undefined ) this.sprite = json.sprite;
        if( json.spriteStand !== undefined ) this.spriteStand = json.spriteStand;
        if( json.spriteAnimated !== undefined ) this.spriteAnimated = json.spriteAnimated;
        if( this.canMove && json.entityMove !== undefined ) this.entityMove.fromJSON(json.entityMove);
    }
}
