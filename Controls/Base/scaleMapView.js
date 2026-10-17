import { Scale } from 'Control/transformation.js';

/**
 * La mise à l'échelle de la carte.
 * Volontairement neutralisée pour l'instant : agrandir la vue se fait en
 * changeant le nombre de cases visibles (la molette), pas en étirant le
 * dessin, qui rendrait les textures floues. À rebrancher le jour où le zoom
 * devra vraiment redimensionner le contrôle.
 */
export class ScaleMapView extends Scale{

    constructor(control){
        super(control);
    }

    to(ratio_width, ratio_height){
    }
}
