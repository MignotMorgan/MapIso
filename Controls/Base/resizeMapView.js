import { Resize } from 'Control/transformation.js';

/**
 * Le redimensionnement de la carte.
 * La hauteur n'est jamais libre : la projection 2:1 impose qu'une vue deux
 * fois plus large soit deux fois plus haute, sinon les losanges se déforment.
 * On ne retient donc que la largeur demandée et on en déduit le reste.
 */
export class ResizeMapView extends Resize{

    constructor(control){
        super(control);
    }

    to(width, height = width){
        const mapview = this.control;
        height = (width - mapview.Border.left - mapview.Border.right)/2;
        height += mapview.Border.top + mapview.Border.bottom;
        super.to(width, height);
        mapview.invalidate();
    }
}
