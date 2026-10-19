import { Draw } from 'Control/draw.js';
import { Textures } from '../../texture.js';

/**
 * Le peintre de la carte.
 *
 * Il ne decide de rien : il lit l'etat prepare par MapView (les cases, leurs
 * cubes, les sprites) et le pose a l'ecran, du fond vers l'avant.
 * Le Paint vient du FormView : un PaintFormView, déjà capable de losanges.
 */
export class DrawMapView extends Draw {

    //showGrid / showNumbers : repères de mise au point, à activer depuis l'éditeur.
    #showGrid = false;
    #showNumbers = false;
    //showHover : losange rouge sur la case survolée.
    #showHover = true;

    constructor(control){
        super(control);
    }

    get showGrid(){ return this.#showGrid; }
    set showGrid(value){ this.#showGrid = !!value; }
    get showNumbers(){ return this.#showNumbers; }
    set showNumbers(value){ this.#showNumbers = !!value; }
    get showHover(){ return this.#showHover; }
    set showHover(value){ this.#showHover = !!value; }

    draw(){
        super.draw();
        const paint = this.Paint;
        const rect = this.control.Rectangle.rectangleBackground();
        paint.clipRectangle(rect.x, rect.y, rect.width, rect.height, () => {
            this.drawMap();
            if(this.#showGrid) this.drawGrid();
            if(this.#showNumbers) this.drawCaseNumbers();
            if(this.#showHover) this.drawLosange(this.control.casePoint.x, this.control.casePoint.y);
        });
    }

    /** Aucun remplissage : on voit le formulaire à travers le rectangle du contrôle. */
    //drawBackground(){}

    /**
     * Le monde, du fond vers l'avant.
     *
     * On monte étage par étage, et dans chaque étage on pose d'abord tous les
     * sols puis tous les volumes. C'est cet ordre qui fait qu'un mur cache bien
     * ce qui est derrière lui : le peintre couvre au fur et à mesure.
     */
    drawMap(){
        const control = this.control;
        if(control.worldMap == null) return;

        const paint = this.Paint;
        const size = control.sizeCase;
        const grab = control.grab;

        for(let z = 0; z <= control.maxZ; z++){
            this.drawFloors(paint, z, size, grab);
            this.drawVolumes(paint, z, size, grab);
        }
    }

    drawFloors(paint, z, size, grab){
        const cases = this.control.cases;
        for(let c = 0; c < cases.length; c++){
            const C2D = cases[c];
            const x = C2D.screen.x + grab.x;
            const y = C2D.screen.y + grab.y;

            if(C2D.cubes.length == 0){
                if(z == 0) this.drawDefault(paint, x, y, size);
                continue;
            }
            for(let i = 0; i < C2D.cubes.length; i++){
                const cube = C2D.cubes[i];
                if(cube != null && cube.z == z)
                    this.drawLayer(paint, cube.floors, cube.floorsSpeed, x, y, size, false);
            }
        }
    }

    drawVolumes(paint, z, size, grab){
        const cases = this.control.cases;
        for(let c = 0; c < cases.length; c++){
            const C2D = cases[c];
            const x = C2D.screen.x + grab.x;
            const y = C2D.screen.y + grab.y;

            for(let i = 0; i < C2D.cubes.length; i++){
                const cube = C2D.cubes[i];
                if(cube != null && cube.z == z)
                    this.drawLayer(paint, cube.volumes, cube.volumesSpeed, x, y, size, true);
            }
            // Les entités s'intercalent entre les volumes du même étage.
            for(let d = 0; d < C2D.entityDraws.length; d++)
                if(C2D.entityDraws[d].z == z)
                    this.drawEntity(paint, C2D.entityDraws[d], grab);
        }
    }

    /** Sol de repère là où la carte est vide : indispensable pour éditer dans le vide. */
    drawDefault(paint, x, y, size){
        this.drawLayer(paint, this.control.floorsDefault, 0, x, y, size, false);
    }

    /**
     * Empile les textures d'une couche sur une case.
     * speed > 0 : le lot est une animation, on n'affiche qu'une image, choisie
     * d'après l'horloge, ce qui synchronise toutes les cases entre elles.
     */
    drawLayer(paint, names, speed, x, y, size, volume){
        if(names == null || names.length == 0) return;

        const rectY = volume ? y - size : y;
        const rectHeight = volume ? size * 2 : size;

        if(speed > 0){
            const i = Math.floor(names.length * ((Date.now() % speed) / speed));
            this.drawTexture(paint, names[i], x - size, rectY, size * 2, rectHeight);
            return;
        }
        for(let i = 0; i < names.length; i++)
            this.drawTexture(paint, names[i], x - size, rectY, size * 2, rectHeight);
    }

    drawTexture(paint, name, x, y, width, height){
        const texture = Textures.get(name);
        if(texture == null) return;
        texture.draw(paint, x, y, width, height);
    }

    /** Le rectangle du sprite est déjà calculé par EntityDraw : on le remplit. */
    drawEntity(paint, entityDraw, grab){
        this.drawTexture(paint, entityDraw.body,
            entityDraw.screen.x + grab.x, entityDraw.screen.y + grab.y,
            entityDraw.width, entityDraw.height);
    }
    drawGrid(){
        const paint = this.Paint;
        const control = this.control;
        const rect = control.Rectangle.rectangleBackground();
        const ctx = paint.context;
        const sizeCase = control.sizeCase;
        const nbrCases = control.nbrCases-1;
        const maxCases = (control.nbrCases*2)-1;

        const color = "#043296ff";
        const lineWidth = 2;

        for( let x = 0; x <= nbrCases; x++){
            let from = control.screenFromCase(x, 0-x);
            let to = control.screenFromCase(maxCases-x, 0-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
            
            from = control.screenFromCase(x, x+1);
            to = control.screenFromCase(maxCases-x, x+1);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(x, 0-x);
            to = control.screenFromCase(x, x+1);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(nbrCases+x+1, 0-(nbrCases-x));
            to = control.screenFromCase(nbrCases+x+1, nbrCases+1-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
        }
        //paint.borderRectangle(rect.x, rect.y, rect.width, rect.height, "black", 2);
    }
    drawCaseNumbers(){
        const control = this.control;
        const paint = this.Paint;
        const sizeCase = control.sizeCase;
        const nbrCases = control.nbrCases;
        const maxCases = (control.nbrCases*2);
        const font = { family: "Arial", size: 10, style: "bold", color: "#000" };
        
        for(let x = 0-maxCases; x <= maxCases; x++){
            for(let y = 0-maxCases; y <= maxCases; y++){
                let c = control.screenFromCase(x, y);
                const abs = Math.abs(x)+Math.abs(y);
                //if(x - y >= -2 && x + y >= -2 && abs <= nbrCases*2){
                
                //if( x+y < -2 || x+y > nbrcube*2 || x-y < -1 || x-y > nbrcube*2+1 )continue;
                if(x - y >= -2 && x + y >= -2 && abs <= maxCases){
                    paint.drawText(c.x-sizeCase/4, c.y+sizeCase/2, `${x},${y}`, font);
                }
            }
        }
    }
    /**
     * Surligne la case (cx, cy).
     * Le losange est tracé directement à partir de sa position ; l'ancienne
     * version testait chaque pixel de la fenêtre, soit plus d'un million de
     * conversions par image.
     */
    drawLosange(cx, cy){
        const control = this.control;
        const paint = this.Paint;
        const size = control.sizeCase;
        const grab = control.grab;

        const C2D = control.findCase(cx, cy);
        const screen = C2D != null ? C2D.screen : control.screenFromCase(cx, cy);
        const x = screen.x + grab.x;
        const y = screen.y + grab.y;

        paint.withAlpha(0.35, () => paint.fillLosange(x, y, size, "#ff0000"));
        paint.strokeLosange(x, y, size, "#ff0000", 2);
    }
}
