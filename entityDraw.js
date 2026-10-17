import { Point } from './point.js';

/**
 * Vue écran d'une Entity : le rectangle où son sprite est dessiné.
 * Aucune logique de monde ici — la position, l'orientation et le trajet
 * appartiennent à l'entité, ce dessin ne fait que les traduire en pixels.
 *
 * sizeCase : largeur d'un losange en pixels (MapView.sizeCase).
 * width/height du dessin = taille du sprite, pas le volume voxel
 * (celui-là, c'est entity.width / entity.height).
 *
 * Appel type : new EntityDraw(entity, mapView.sizeCase, adjusted)
 * puis toScreen(...) avec le point renvoyé par mapView.screenFromLocation.
 */
export class EntityDraw{

    #entity = null;
    #width = 0;
    #height = 0;
    #sizeCase = 0;
    #adjusted = false;
    #screen = new Point();

    constructor(entity, sizeCase, adjusted = false){
        this.#entity = entity;
        // Sprite iso 2:1 : largeur = 2 cubes × volume, hauteur = hauteur voxel + profondeur.
        this.#width = sizeCase * 2 * entity.width;
        this.#height = sizeCase * entity.height + sizeCase * entity.width;
        this.#sizeCase = sizeCase;
        this.#adjusted = !!adjusted;
        this.toScreen(new Point());
    }

    get entity(){ return this.#entity; }
    get id(){ return this.#entity.id; }
    get width(){ return this.#width; }
    get height(){ return this.#height; }
    get sizeCase(){ return this.#sizeCase; }
    get adjusted(){ return this.#adjusted; }
    get screen(){ return this.#screen; }
    set screen(value){ this.#screen.copy(value); }

    // On lit ces valeurs chez l'entité plutôt que d'en garder une copie, qui se
    // périmerait dès qu'elle bouge.
    get location(){ return this.#entity.location; }
    get x(){ return this.#entity.x; }
    get y(){ return this.#entity.y; }
    get z(){ return this.#entity.z; }
    get body(){ return this.#entity.body; }
    get canMove(){ return this.#entity.canMove; }
    get adjustment(){ return this.#entity.adjustment; }
    get direction(){ return this.#entity.direction; }
    set direction(value){ this.#entity.direction = value; }


    toScreen(point){
        this.#screen.x = point.x - (this.#width/2);
        this.#screen.y = point.y - this.#height + (this.#width/2);
        if(this.#adjusted){
            const adjustment = this.#entity.adjustment;
            this.#screen.x += this.#sizeCase * (adjustment.x / 100);
            this.#screen.y += this.#sizeCase * (adjustment.y / 100);
        }
    }
}