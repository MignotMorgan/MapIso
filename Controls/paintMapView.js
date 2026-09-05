import { Paint } from 'Control/paint.js';

/**
 * Le Paint de la vue isométrique.
 *
 * MapView est un contrôle, pas un formulaire : il n'a pas de canvas.
 * Celui du formulaire est partagé par tous les contrôles de la fenêtre.
 * PaintMapView enveloppe ce Paint et lui ajoute les losanges et polygones.
 * DrawMapView le pose sur son getter Paint, pour que tout le dessin —
 * y compris le fond et la bordure hérités de Draw — passe par un seul objet.
 *
 * Repère des losanges : (x, y) est le sommet HAUT de la case.
 * Un losange fait 2×size de large et size de haut (projection 2:1), donc :
 *   haut   (x, y)            droite (x + size, y + size/2)
 *   bas    (x, y + size)     gauche (x - size, y + size/2)
 */
export class PaintMapView extends Paint{

    #paint = null;

    constructor(paint){
        super();
        this.#paint = paint ?? null;
    }

    /** Le Paint du formulaire, celui qui tient le canvas. */
    get paint(){ return this.#paint; }
    set paint(value){ this.#paint = value ?? null; }
    get context(){ return this.#paint == null ? null : this.#paint.context; }

    /** Les 4 sommets du losange d'une case, dans le sens horaire depuis le haut. */
    losange(x, y, size){
        const half = size / 2;
        return [
            {x:x,        y:y},
            {x:x + size, y:y + half},
            {x:x,        y:y + size},
            {x:x - size, y:y + half}
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

    get font(){ return this.#paint.font; }
    set font(value){ this.#paint.font = value; }
    get textbaseline(){ return this.#paint.textbaseline; }
    set textbaseline(value){ this.#paint.textbaseline = value; }
    get fillColor(){ return this.#paint.fillColor; }
    set fillColor(value){ this.#paint.fillColor = value; }

    clear(){ this.#paint.clear(); }
    save(){ this.#paint.save(); }
    restore(){ this.#paint.restore(); }
    move(x, y){ this.#paint.move(x, y); }
    resize(width, height){ this.#paint.resize(width, height); }
    default(){ this.#paint.default(); }
    measureText(text, font){ return this.#paint.measureText(text, font); }
    cutText(text, width){ return this.#paint.cutText(text, width); }
    drawRectangle(x, y, width, height, color){ this.#paint.drawRectangle(x, y, width, height, color); }
    borderRectangle(x, y, width, height, color, lineWidth){ this.#paint.borderRectangle(x, y, width, height, color, lineWidth); }
    borderRectangleStyled(x, y, width, height, options){ this.#paint.borderRectangleStyled(x, y, width, height, options); }
    drawLine(x1, y1, x2, y2, color, lineWidth){ this.#paint.drawLine(x1, y1, x2, y2, color, lineWidth); }
    drawText(x, y, text, font){ this.#paint.drawText(x, y, text, font); }
    withAlpha(alpha, action){ this.#paint.withAlpha(alpha, action); }
    clipRectangle(x, y, width, height, action){ this.#paint.clipRectangle(x, y, width, height, action); }

    drawImage(image, x, y, width, height){
        if(image == null) return;
        // Une image pas encore téléchargée n'a aucune dimension : la dessiner lèverait une erreur.
        if(!(image.naturalWidth > 0) && !(image.width > 0)) return;
        this.#paint.drawImage(image, x, y, width, height);
    }

    /**
     * On lâche le Paint du formulaire, on ne le détruit pas : il ne nous
     * appartient pas, et les autres contrôles dessinent encore dessus.
     */
    dispose(){ this.#paint = null; }
}
