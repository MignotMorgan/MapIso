import { PaintCanvas } from 'Control/paint.js';
import { Point } from '../../point.js';

/**
 * Le Paint du FormView.
 *
 * C'est un PaintCanvas : il crée et possède le canvas de la fenêtre.
 * Les primitives isométriques (losange, polygone) vivent ici, pour que
 * MapView dessine sur le peintre du formulaire sans l'envelopper.
 *
 * Repère des losanges : (x, y) est le sommet HAUT de la case.
 * Un losange fait 2×size de large et size de haut (projection 2:1), donc :
 *   haut   (x, y)            droite (x + size, y + size/2)
 *   bas    (x, y + size)     gauche (x - size, y + size/2)
 */
export class PaintFormView extends PaintCanvas{

    constructor(x, y, width, height, hide = false){
        super(x, y, width, height, hide);
    }

    /** Les 4 sommets du losange d'une case, dans le sens horaire depuis le haut. */
    losange(x, y, size){
        const half = size / 2;
        return [
            new Point(x,        y),
            new Point(x + size, y + half),
            new Point(x,        y + size),
            new Point(x - size, y + half)
        ];
    }

    fillPolygon(points, color){
        const ctx = this.context;
        if(ctx == null || points == null || points.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for(let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    strokePolygon(points, color, lineWidth = 1){
        const ctx = this.context;
        if(ctx == null || points == null || points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for(let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    fillLosange(x, y, size, color){
        this.fillPolygon(this.losange(x, y, size), color);
    }

    strokeLosange(x, y, size, color, lineWidth = 1){
        this.strokePolygon(this.losange(x, y, size), color, lineWidth);
    }

    drawImage(image, x, y, width, height){
        if(image == null) return;
        // Une image pas encore téléchargée n'a aucune dimension : la dessiner lèverait une erreur.
        if(!(image.naturalWidth > 0) && !(image.width > 0)) return;
        super.drawImage(image, x, y, width, height);
    }
}
