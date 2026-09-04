/**
 * Vue écran d'une Entity : rectangle sprite + interpolation de marche.
 * Ne possède pas la logique monde (ça reste sur Entity).
 *
 * sizeCube : largeur d'un losange en pixels (MapView.sizeCase).
 * width/height du draw = taille sprite, pas le volume voxel (entity.width/height).
 *
 * Appel type : new EntityDraw(entity, mapView.sizeCase, adjusted)
 * Puis toScreen(screen.x, screen.y) avec le point renvoyé par mapView.screenFromLocation.
 */
export class EntityDraw{
    constructor(entity, sizeCube, adjusted = false){
        this.id = entity.id;
        this.canMove = entity.canMove;
        this.body = entity.body;
        this.x = entity.x;
        this.y = entity.y;
        this.z = entity.z;
        this.adjustment = {x: entity.adjustment.x, y: entity.adjustment.y};
        this.direction = entity.direction;
        // Sprite iso 2:1 : largeur = 2 cubes × volume, hauteur = hauteur voxel + profondeur.
        this.width = sizeCube * 2 * entity.width;
        this.height = sizeCube * entity.height + sizeCube * entity.width;
        this.move = entity.move;
        this.moveDraw = entity.moveDraw;
        this.sizeCube = sizeCube;
        this.adjusted = adjusted; // si true, adjustment % décale le sprite dans la case
        this.location = {x: entity.x, y: entity.y, z: entity.z};
        this.screen = {x:0, y:0};
        this.toScreen(0, 0);
    }
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
    /**
     * Prépare l'interpolation d'un segment de street vers location_dest.
     * distance = vecteur pixel case→case ; time = max(|dx|,|dy|) × speed
     * (on prend l'axe le plus long pour que le sprite n'arrive pas trop tôt).
     */
    onDistance(location_dest, adjustment){
        this.moveDraw.location.x = this.x;
        this.moveDraw.location.y = this.y;
        this.moveDraw.location.z = this.z;
        this.moveDraw.adjustment.x = this.adjustment.x;
        this.moveDraw.adjustment.y = this.adjustment.y;

        // Monde 3D → case 2D iso : on retire z (parallaxe déjà dans x/y monde).
        const case_src = {
            x: this.moveDraw.location.x - this.moveDraw.location.z,
            y: this.moveDraw.location.y - this.moveDraw.location.z,
            adjustment: {x: this.moveDraw.adjustment.x, y: this.moveDraw.adjustment.y}
        };
        const case_dest = {
            x: location_dest.x - location_dest.z,
            y: location_dest.y - location_dest.z,
            adjustment: {x: adjustment.x, y: adjustment.y}
        };

        this.moveDraw.distance = this.caseToCase(case_src, case_dest);
        this.moveDraw.drawStep = 0;

        const ratio_X = Math.abs(this.moveDraw.distance.x / 100);
        const ratio_Y = Math.abs(this.moveDraw.distance.y / 100);
        const ratio_Speed_X = this.move.speed * ratio_X;
        const ratio_Speed_Y = this.move.speed * ratio_Y;
        this.moveDraw.time = ratio_Speed_X > ratio_Speed_Y ? ratio_Speed_X : ratio_Speed_Y;
        this.direction = this.screenDirection(this.moveDraw.distance.x, this.moveDraw.distance.y);
    }
    /** Vecteur pixel entre deux cases, ajustements sous-case inclus (centièmes). */
    caseToCase(case_src, case_dest){
        const cX = case_dest.x - case_src.x;
        const cY = case_dest.y - case_src.y;
        return {
            x: ((cX - cY) * 100) + case_dest.adjustment.x - case_src.adjustment.x,
            y: ((cX + cY) * 50) + case_dest.adjustment.y - case_src.adjustment.y
        };
    }
    /**
     * Direction carte (voisinage 8) d'après delta monde.
     * Codes : 0 N, 1 E, 2 S, 3 W, 4 N-W, 5 N-E, 6 none / S-E, 7 S-W.
     */
    changeDirection(x_src, y_src, z_src, x_dest, y_dest, z_dest){
        if ( x_src == x_dest && y_src == y_dest)return 6;
        else if ( x_src == x_dest && y_src > y_dest)return 0;
        else if ( x_src < x_dest && y_src == y_dest)return 1;
        else if ( x_src == x_dest && y_src < y_dest)return 2;
        else if ( x_src > x_dest && y_src == y_dest)return 3;
        else if ( x_src > x_dest && y_src > y_dest)return 4;
        else if ( x_src < x_dest && y_src > y_dest)return 5;
        else if ( x_src < x_dest && y_src < y_dest)return 6;
        else if ( x_src > x_dest && y_src < y_dest)return 7;
        return 6;
    }
    /**
     * Direction d'après le vecteur pixel de marche (pas les cubes).
     * Zone morte ±25 : un tout petit delta ne tourne pas le sprite.
     */
    screenDirection(x_dest, y_dest){
        let x = 0;
        let y = 0;

        if( -25 < x_dest && x_dest < 25){
            if(x_dest < 0)x = -1;
            else if(x_dest > 0)x = 1;
        } else {
            if(x_dest < -25)x = -1;
            else if(x_dest > 25)x = 1;
        }

        if( -25 < y_dest && y_dest < 25){
            if(y_dest < 0)y = -1;
            else if(y_dest > 0)y = 1;
        } else {
            if(y_dest < -25)y = -1;
            else if(y_dest > 25)y = 1;
        }

        if( x == 0 && y == 0 )return 6;
        else if( x == 1 && y == -1 )return 0;
        else if( x == 1 && y == 1 )return 1;
        else if( x == -1 && y == 1 )return 2;
        else if( x == -1 && y == -1 )return 3;
        else if( x == 0 && y == -1 )return 4;
        else if( x == 1 && y == 0 )return 5;
        else if( x == 0 && y == 1 )return 6;
        else if( x == -1 && y == 0 )return 7;
        return 6;
    }
}
