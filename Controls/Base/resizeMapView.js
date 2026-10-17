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
        const control = this.control;
        height = (width - control.Border.left - control.Border.right)/2;
        height += control.Border.top + control.Border.bottom;
        super.to(width, height);
        control.modified();
    }
}
