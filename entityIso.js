import { Point, Location, Direction } from './pointIso.js';
import { EntityMove } from './entityMove.js';

/**
 * Modèle monde d'un personnage / objet.
 * Distinct de EntityDraw (sprite à l'écran) et de Cube (voxel de terrain).
 *
 * Position (x,y,z) : coin supérieur-droit-arrière du volume.
 * Le volume va vers x/y décroissants et z croissant : base width×width, hauteur height.
 *
 * Le constructeur accepte le JSON serveur (ID, CanMove, Body_Stand…)
 * et le convertit en camelCase interne.
 */
export class Entity{
    #id = "";
    #location = null;          // position dans le monde voxel
    #width = 1;
    #height = 1;
    #adjustment = null;        // offset dans la case, en % de sizeCube (0..100)
    #direction = Direction.NONE;
    #canMove = false;
    #canTarget = false;
    #cross = false;            // d'autres entités peuvent traverser ce volume
    #body = null;              // sprite / animation courante
    #bodyStand = null;         // sprite idle, repris quand l'anim se termine
    #bodyAnimated = false;
    #map = null;               // carte d'appartenance (pathfinding, collisions)
    #move = null;

    constructor(x, y, z, options = {}){
        this.#location = new Location(x, y, z);

        this.#id = options.id ?? options.ID ?? "";
        this.#width = options.width ?? options.Width ?? 1;
        this.#height = options.height ?? options.Height ?? 1;
        this.#adjustment = Point.from(options.adjustment ?? options.Adjustment);
        this.#direction = options.direction ?? options.Direction ?? Direction.NONE;
        this.#canMove = options.canMove ?? options.CanMove ?? false;
        this.#canTarget = options.canTarget ?? options.CanTarget ?? false;
        this.#cross = options.cross ?? options.Cross ?? false;
        this.#body = options.body ?? options.Body ?? null;
        this.#bodyStand = options.bodyStand ?? options.Body_Stand ?? null;
        this.#bodyAnimated = options.bodyAnimated ?? options.Body_Animated ?? false;
        this.#map = options.map ?? options.Map ?? null;
        this.#move = EntityMove.from(options.move ?? options.Move);
        // Une entité qui peut marcher a forcément besoin de son carnet de route :
        // sans lui, le calcul de chemin refuse de la faire bouger.
        if(this.#move == null && this.#canMove) this.#move = EntityMove.empty();
    }

    get id(){ return this.#id; }
    set id(value){ this.#id = value ?? ""; }
    /** La position dans le monde. x, y et z en sont les raccourcis de lecture. */
    get location(){ return this.#location; }
    get x(){ return this.#location.x; }
    set x(value){ this.#location.x = value; }
    get y(){ return this.#location.y; }
    set y(value){ this.#location.y = value; }
    get z(){ return this.#location.z; }
    set z(value){ this.#location.z = value; }
    get width(){ return this.#width; }
    set width(value){ this.#width = value ?? 1; }
    get height(){ return this.#height; }
    set height(value){ this.#height = value ?? 1; }
    get adjustment(){ return this.#adjustment; }
    get direction(){ return this.#direction; }
    set direction(value){ this.#direction = value ?? Direction.NONE; }
    get canMove(){ return this.#canMove; }
    set canMove(value){
        this.#canMove = !!value;
        if(this.#canMove && this.#move == null) this.#move = EntityMove.empty();
    }
    get canTarget(){ return this.#canTarget; }
    set canTarget(value){ this.#canTarget = !!value; }
    get cross(){ return this.#cross; }
    set cross(value){ this.#cross = !!value; }
    get body(){ return this.#body; }
    set body(value){ this.#body = value ?? null; }
    get bodyStand(){ return this.#bodyStand; }
    set bodyStand(value){ this.#bodyStand = value ?? null; }
    get bodyAnimated(){ return this.#bodyAnimated; }
    set bodyAnimated(value){ this.#bodyAnimated = !!value; }
    get map(){ return this.#map; }
    set map(value){ this.#map = value ?? null; }
    get move(){ return this.#move; }
    set move(value){ this.#move = EntityMove.from(value); }

    /** L'entité est-elle en train de parcourir un trajet ? */
    get walking(){ return this.#move != null && this.#move.walking; }

    /**
     * Le pas en cours, ou null à l'arrêt.
     * C'est ce que la vue utilise pour placer le sprite entre deux cases.
     */
    stride(){ return this.#move == null ? null : this.#move.stride(); }

    /**
     * Fait avancer l'entité de elapsed millisecondes le long de son trajet.
     * Renvoie true si elle vient de changer de case, ce qui permet à la vue de
     * ne réagir (plafonds, tri) qu'aux vrais changements.
     *
     * La position logique saute sur la case visée dès le début du pas :
     * l'entité occupe la case dans laquelle elle entre, le sprite la rattrape.
     */
    advance(elapsed){
        if(!this.walking) return false;
        if(this.#move.advance(elapsed)){ this.stop(); return true; }

        const stride = this.#move.stride();
        if(stride == null){ this.stop(); return true; }
        if(this.#location.equals(stride.to)) return false;

        this.#direction = stride.direction;
        this.#location.copy(stride.to);
        return true;
    }

    /** Termine le trajet : on se pose sur la dernière case et on range le carnet. */
    stop(){
        if(this.#move == null) return;
        this.#location.copy(this.#move.destination);
        this.#move.clear();
        this.#bodyAnimated = false;
    }

    /** Lance l'entité sur un trajet déjà calculé, depuis le début. */
    walk(street){
        if(this.#move == null || !this.#move.start(street)) return false;
        this.#bodyAnimated = true;
        return true;
    }

    /**
     * Collision point ↔ volume 3D.
     * Utilisé pour savoir si un clic / un cube vise cette entité.
     */
    contains(px, py, pz){
        const location = this.#location;
        return (px <= location.x) && (px > location.x - this.#width)
            && (py <= location.y) && (py > location.y - this.#width)
            && (pz >= location.z) && (pz < location.z + this.#height);
    }

    /**
     * Les champs privés sont invisibles pour JSON.stringify : on les expose ici.
     * map est volontairement omis : c'est la carte qui contient l'entité, pas l'inverse.
     */
    toJSON(){
        return {
            id: this.#id,
            x: this.#location.x, y: this.#location.y, z: this.#location.z,
            width: this.#width, height: this.#height,
            adjustment: this.#adjustment, direction: this.#direction,
            canMove: this.#canMove, canTarget: this.#canTarget, cross: this.#cross,
            body: this.#body, bodyStand: this.#bodyStand, bodyAnimated: this.#bodyAnimated,
            move: this.#move
        };
    }
}
