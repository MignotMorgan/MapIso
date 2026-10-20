import { Point, Location } from './point.js';
import { EntityMove, Direction } from './entityMove.js';

/**
 * Modèle monde d'un personnage / objet.
 * Distinct de EntityDraw (sprite à l'écran) et de Cube (voxel de terrain).
 *
 * Position (x,y,z) : coin supérieur-droit-arrière du volume.
 * Le volume va vers x/y décroissants et z croissant : base width×width, hauteur height.
 *
 * Le constructeur lit le JSON camelCase (id, canMove, spriteStand…).
 */
export class Entity{
    #id = "";
    #location = null;          // position dans le monde voxel
    #width = 1;
    #height = 1;
    #adjustment = new Point(); // offset dans la case, en % de sizeCase (0..100)
    #direction = Direction.NONE;
    #canMove = false;
    #canTarget = false;
    #walkable = false;         // d'autres entités peuvent traverser ce volume
    #sprite = null;            // sprite / animation courante
    #spriteStand = null;       // sprite idle, repris quand l'anim se termine
    #spriteAnimated = false;
    #worldMap = null;          // carte d'appartenance (pathfinding, collisions)
    #entityMove = null;

    constructor(x, y, z, options = {}){
        this.#location = new Location(x, y, z);

        this.#id = options.id ?? "";
        this.#width = options.width ?? 1;
        this.#height = options.height ?? 1;
        this.#adjustment.copy(Point.from(options.adjustment));
        this.#direction = options.direction ?? Direction.NONE;
        this.#canMove = options.canMove ?? false;
        this.#canTarget = options.canTarget ?? false;
        this.#walkable = options.walkable ?? false;
        this.#sprite = options.sprite ?? null;
        this.#spriteStand = options.spriteStand ?? null;
        this.#spriteAnimated = options.spriteAnimated ?? false;
        this.#worldMap = options.worldMap ?? null;
        this.#entityMove = EntityMove.from(options.entityMove);
        // Une entité qui peut marcher a forcément besoin de son carnet de route :
        // sans lui, le calcul de chemin refuse de la faire bouger.
        if(this.#entityMove == null && this.#canMove) this.#entityMove = EntityMove.empty();
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
        if(this.#canMove && this.#entityMove == null) this.#entityMove = EntityMove.empty();
    }
    get canTarget(){ return this.#canTarget; }
    set canTarget(value){ this.#canTarget = !!value; }
    get walkable(){ return this.#walkable; }
    set walkable(value){ this.#walkable = !!value; }
    get sprite(){ return this.#sprite; }
    set sprite(value){ this.#sprite = value ?? null; }
    get spriteStand(){ return this.#spriteStand; }
    set spriteStand(value){ this.#spriteStand = value ?? null; }
    get spriteAnimated(){ return this.#spriteAnimated; }
    set spriteAnimated(value){ this.#spriteAnimated = !!value; }
    get worldMap(){ return this.#worldMap; }
    set worldMap(value){ this.#worldMap = value ?? null; }
    get entityMove(){ return this.#entityMove; }
    set entityMove(value){ this.#entityMove = EntityMove.from(value); }

    /** L'entité est-elle en train de parcourir un trajet ? */
    get walking(){ return this.#entityMove != null && this.#entityMove.walking; }

    /**
     * Le pas en cours, ou null à l'arrêt.
     * C'est ce que la vue utilise pour placer le sprite entre deux cases.
     */
    stride(){ return this.#entityMove == null ? null : this.#entityMove.stride(); }

    /**
     * Du temps a passé. Aujourd'hui : le déplacement (délégué à EntityMove).
     * Plus tard : dégâts, événements, IA — toujours ici, jamais dans la vue.
     * Renvoie true si la case logique a changé.
     */
    tick(elapsed){
        if(this.#entityMove == null) return false;
        const changed = this.#entityMove.progress(elapsed, this);
        if(!this.walking) this.#spriteAnimated = false;
        return changed;
    }

    /** Interrompt le trajet : on se pose et on range le carnet. */
    stop(){
        if(this.#entityMove == null) return;
        this.#location.copy(this.#entityMove.destination);
        this.#entityMove.clear();
        this.#spriteAnimated = false;
    }

    /** Lance l'entité sur un trajet déjà calculé, depuis le début. */
    walk(path){
        if(this.#entityMove == null || !this.#entityMove.start(path)) return false;
        this.#spriteAnimated = true;
        return true;
    }

    /**
     * Collision point ↔ volume 3D.
     * Utilisé pour savoir si un clic / un cube vise cette entité.
     */
    contains(wx, wy, wz){
        const location = this.#location;
        return (wx <= location.x) && (wx > location.x - this.#width)
            && (wy <= location.y) && (wy > location.y - this.#width)
            && (wz >= location.z) && (wz < location.z + this.#height);
    }

    /**
     * Les champs privés sont invisibles pour JSON.stringify : on les expose ici.
     * worldMap est volontairement omis : c'est la carte qui contient l'entité, pas l'inverse.
     */
    toJSON(){
        return {
            id: this.#id,
            x: this.#location.x,
            y: this.#location.y,
            z: this.#location.z,
            width: this.#width,
            height: this.#height,
            adjustment: this.#adjustment,
            direction: this.#direction,
            canMove: this.#canMove,
            canTarget: this.#canTarget,
            walkable: this.#walkable,
            sprite: this.#sprite,
            spriteStand: this.#spriteStand,
            spriteAnimated: this.#spriteAnimated,
            entityMove: this.#entityMove
        };
    }
}
