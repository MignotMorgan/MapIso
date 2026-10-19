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
     * On termine un étage partout avant de passer au suivant : un personnage
     * sur une plateforme (z+1) se peint après le sol de devant (z), donc
     * dessus. Dans un étage, les cases sont déjà triées x+y puis x-y :
     * un mur devant cache ce qui est derrière au même z.
     */
    drawMap(){
        const control = this.control;
        if(control.worldMap == null) return;

        const paint = this.Paint;
        const size = control.sizeCase;
        const cases = control.cases;
        const maxZ = control.maxZ;

        for(let z = 0; z <= maxZ; z++){
            for(let c = 0; c < cases.length; c++)
                this.drawCaseZ(paint, cases[c], z, size);
        }
    }

    drawCaseZ(paint, C2D, z, size){
        const x = C2D.screen.x;
        const y = C2D.screen.y;
        const cubes = C2D.cubes;

        if(cubes.length == 0){
            if(z == 0) this.drawDefault(paint, x, y, size);
        } else {
            for(let i = 0; i < cubes.length; i++){
                const cube = cubes[i];
                if(cube != null && cube.z == z)
                    this.drawLayer(paint, cube.floors, cube.floorsSpeed, x, y, size, false);
            }
            for(let i = 0; i < cubes.length; i++){
                const cube = cubes[i];
                if(cube != null && cube.z == z)
                    this.drawLayer(paint, cube.volumes, cube.volumesSpeed, x, y, size, true);
            }
        }
        this.drawEntities(paint, C2D, z);
    }

    drawEntities(paint, C2D, z){
        const draws = C2D.entityDraws;
        for(let d = 0; d < draws.length; d++)
            if(draws[d].z == z)
                this.drawEntity(paint, draws[d]);
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
            const world = this.control.worldMap;
            const t = world == null ? 0 : world.time;
            const i = Math.floor(names.length * ((t % speed) / speed));
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
    drawEntity(paint, entityDraw){
        this.drawTexture(paint, entityDraw.body,
            entityDraw.screen.x, entityDraw.screen.y,
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

        const C2D = control.findCase(cx, cy);
        const screen = C2D != null ? C2D.screen : control.screenFromCase(cx, cy);
        const x = screen.x;
        const y = screen.y;

        paint.withAlpha(0.35, () => paint.fillLosange(x, y, size, "#ff0000"));
        paint.strokeLosange(x, y, size, "#ff0000", 2);
    }
}
