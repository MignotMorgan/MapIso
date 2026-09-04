// Normalise un point 2D. Accepte camelCase (x,y) ou l'ancien JSON (X,Y).
function point2(value){
    const v = value ?? {};
    return { x: v.x ?? v.X ?? 0, y: v.y ?? v.Y ?? 0 };
}
// Idem en 3D (monde voxel : x/y sol, z altitude).
function point3(value){
    const v = value ?? {};
    return { x: v.x ?? v.X ?? 0, y: v.y ?? v.Y ?? 0, z: v.z ?? v.Z ?? 0 };
}
/**
 * Déplacement logique (chemin BFS, pas l'animation écran).
 * null = l'entité n'a pas d'ordre de marche (pathfinding.moveTo abandonne).
 * street : liste de cubes {x,y,z} du départ à l'arrivée.
 * speed  : durée d'un pas, utilisée par EntityDraw pour interpoler.
 */
function toMove(value){
    if(value == null) return null;
    return {
        id: value.id ?? value.ID ?? 0,
        street: value.street ?? value.Street ?? [],
        speed: value.speed ?? value.Speed ?? 0,
        step: value.step ?? value.Step ?? 0,
        body: value.body ?? value.Body ?? null,
        adjustment: point2(value.adjustment ?? value.Adjustment)
    };
}
/**
 * État d'interpolation visuelle entre deux cubes de street.
 * Toujours créé : même à l'arrêt, location reflète x,y,z de l'entité.
 * index / drawStep / time : progression du segment courant (voir EntityDraw.onDistance).
 */
function toMoveDraw(value, x, y, z, adjustment){
    const v = value ?? {};
    return {
        location: point3(v.location ?? v.Location ?? {x, y, z}),
        adjustment: point2(v.adjustment ?? v.Adjustment ?? adjustment),
        distance: point2(v.distance ?? v.Distance),
        drawStep: v.drawStep ?? v.DrawStep ?? 0,
        index: v.index ?? v.Index ?? 0,
        time: v.time ?? v.Time ?? 0
    };
}

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
    #x = 0;
    #y = 0;
    #z = 0;
    #width = 1;
    #height = 1;
    #adjustment = {x:0, y:0};  // offset dans la case, en % de sizeCube (0..100)
    #direction = 6;            // 0 N … 7 S-W ; 6 = none (pas de sprite tourné)
    #canMove = false;
    #canTarget = false;
    #cross = false;            // d'autres entités peuvent traverser ce volume
    #body = null;              // sprite / animation courante
    #bodyStand = null;         // sprite idle, repris quand l'anim se termine
    #bodyAnimated = false;
    #map = null;               // carte d'appartenance (pathfinding, collisions)
    #move = null;
    #moveDraw = null;

    constructor(x, y, z, options = {}){
        this.#x = x;
        this.#y = y;
        this.#z = z;

        this.#id = options.id ?? options.ID ?? "";
        this.#width = options.width ?? options.Width ?? 1;
        this.#height = options.height ?? options.Height ?? 1;
        this.#adjustment = point2(options.adjustment ?? options.Adjustment);
        this.#direction = options.direction ?? options.Direction ?? 6;
        this.#canMove = options.canMove ?? options.CanMove ?? false;
        this.#canTarget = options.canTarget ?? options.CanTarget ?? false;
        this.#cross = options.cross ?? options.Cross ?? false;
        this.#body = options.body ?? options.Body ?? null;
        this.#bodyStand = options.bodyStand ?? options.Body_Stand ?? null;
        this.#bodyAnimated = options.bodyAnimated ?? options.Body_Animated ?? false;
        this.#map = options.map ?? options.Map ?? null;
        this.#move = toMove(options.move ?? options.Move);
        this.#moveDraw = toMoveDraw(options.moveDraw ?? options.MoveDraw, x, y, z, this.#adjustment);
    }

    get id(){ return this.#id; }
    set id(value){ this.#id = value ?? ""; }
    get x(){ return this.#x; }
    set x(value){ this.#x = value ?? 0; }
    get y(){ return this.#y; }
    set y(value){ this.#y = value ?? 0; }
    get z(){ return this.#z; }
    set z(value){ this.#z = value ?? 0; }
    get width(){ return this.#width; }
    set width(value){ this.#width = value ?? 1; }
    get height(){ return this.#height; }
    set height(value){ this.#height = value ?? 1; }
    get adjustment(){ return this.#adjustment; }
    get direction(){ return this.#direction; }
    set direction(value){ this.#direction = value ?? 6; }
    get canMove(){ return this.#canMove; }
    set canMove(value){ this.#canMove = !!value; }
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
    set move(value){ this.#move = toMove(value); }
    get moveDraw(){ return this.#moveDraw; }
    set moveDraw(value){ this.#moveDraw = toMoveDraw(value, this.#x, this.#y, this.#z, this.#adjustment); }

    /**
     * Collision point ↔ volume 3D.
     * Utilisé pour savoir si un clic / un cube vise cette entité.
     */
    contains(px, py, pz){
        return (px <= this.#x) && (px > this.#x - this.#width)
            && (py <= this.#y) && (py > this.#y - this.#width)
            && (pz >= this.#z) && (pz < this.#z + this.#height);
    }
}
