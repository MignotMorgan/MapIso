/**
 * Primitives de dessin propres à la vue isométrique, posées sur le Paint du framework.
 *
 * Repère utilisé partout ici : (x, y) est le sommet HAUT du losange d'une case.
 * Un losange fait 2×size de large et size de haut (projection 2:1), donc :
 *   haut   (x, y)            droite (x + size, y + size/2)
 *   bas    (x, y + size)     gauche (x - size, y + size/2)
 *
 * Le framework Control ne fournit pas encore de tracé de polygone : c'est la
 * seule classe du moteur autorisée à toucher au contexte canvas, pour n'avoir
 * qu'un seul endroit à modifier le jour où Paint saura le faire lui-même.
 */
export class PaintIso{

    #paint = null;

    constructor(paint){
        this.#paint = paint ?? null;
    }

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

    drawImage(image, x, y, width, height){
        if(this.#paint == null || image == null) return;
        // Une image pas encore téléchargée n'a aucune dimension : la dessiner lèverait une erreur.
        if(!(image.naturalWidth > 0) && !(image.width > 0)) return;
        this.#paint.drawImage(image, x, y, width, height);
    }

    withAlpha(alpha, action){
        if(this.#paint == null) return;
        this.#paint.withAlpha(alpha, action);
    }
}
