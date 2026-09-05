/**
 * Vue écran d'une Entity : le rectangle où son sprite est dessiné.
 * Aucune logique de monde ici — la position, l'orientation et le trajet
 * appartiennent à l'entité, ce dessin ne fait que les traduire en pixels.
 *
 * sizeCube : largeur d'un losange en pixels (MapView.sizeCase).
 * width/height du dessin = taille du sprite, pas le volume voxel
 * (celui-là, c'est entity.width / entity.height).
 *
 * Appel type : new EntityDraw(entity, mapView.sizeCase, adjusted)
 * puis toScreen(...) avec le point renvoyé par mapView.screenFromLocation.
 */
export class EntityDraw{
    constructor(entity, sizeCube, adjusted = false){
        this.entity = entity;
        this.id = entity.id;
        // Sprite iso 2:1 : largeur = 2 cubes × volume, hauteur = hauteur voxel + profondeur.
        this.width = sizeCube * 2 * entity.width;
        this.height = sizeCube * entity.height + sizeCube * entity.width;
        this.sizeCube = sizeCube;
        this.adjusted = adjusted; // si true, adjustment % décale le sprite dans la case
        this.screen = {x:0, y:0};
        this.toScreen(0, 0);
    }

    // On lit ces valeurs chez l'entité plutôt que d'en garder une copie, qui se
    // périmerait dès qu'elle bouge.
    get location(){ return this.entity.location; }
    get x(){ return this.entity.x; }
    get y(){ return this.entity.y; }
    get z(){ return this.entity.z; }
    get body(){ return this.entity.body; }
    get canMove(){ return this.entity.canMove; }
    get adjustment(){ return this.entity.adjustment; }
    get direction(){ return this.entity.direction; }
    set direction(value){ this.entity.direction = value; }

    /**
     * Ancre le rectangle sprite : (x,y) est le point « pieds » iso,
     * le sprite s'étend vers le haut et se centre en X.
     */
    toScreen(x, y){
        this.screen.x = x - (this.width/2);
        this.screen.y = y - this.height + (this.width/2);
        if(this.adjusted){
            this.screen.x += this.sizeCube * (this.adjustment.x / 100);
            this.screen.y += this.sizeCube * (this.adjustment.y / 100);
        }
    }
    /** Le point donné est en repère écran : c'est là que se posent les pieds. */
    toScreenPoint(point){ this.toScreen(point.x, point.y); }
}
