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

    //showGrid / showCaseNumbers : repères de mise au point, à activer depuis l'éditeur.
    #showGrid = false;
    #showCaseNumbers = false;
    //showHover : losange rouge sur la case survolée.
    #showHover = true;

    constructor(control){
        super(control);
    }

    get showGrid(){ return this.#showGrid; }
    set showGrid(value){ this.#showGrid = !!value; }
    get showCaseNumbers(){ return this.#showCaseNumbers; }
    set showCaseNumbers(value){ this.#showCaseNumbers = !!value; }
    get showHover(){ return this.#showHover; }
    set showHover(value){ this.#showHover = !!value; }

    draw(){
        super.draw();
        const paint = this.Paint;
        const rect = this.control.Rectangle.rectangleBackground();
        //paint.clipRectangle(rect.x, rect.y, rect.width, rect.height, () => {
            this.drawMap();
            if(this.#showGrid) this.drawGrid();
            if(this.#showCaseNumbers) this.drawCaseNumbers();
            if(this.#showHover) this.drawHover(this.control.casePoint.x, this.control.casePoint.y);
        //});
    }

    /**
     * Le monde, du fond vers l'avant.
     *
     * On termine un étage partout avant de passer au suivant : un personnage
     * sur une plateforme (z+1) se peint après le sol de devant (z), donc
     * dessus. Dans un étage, les cases sont déjà triées x+y puis x-y :
     * un mur devant cache ce qui est derrière au même z.
     */
    drawMap(){
        const mapview = this.control;
        if(mapview.worldMap == null) return;

        const paint = this.Paint;
        const sizeCase = mapview.sizeCase;
        const cases = mapview.cases;
        const maxZ = mapview.maxZ;

        for(let z = 0; z <= maxZ; z++){
            for(let i = 0; i < cases.length; i++){
                const c = cases[i];
                this.drawCaseZ(paint, c, z, sizeCase);
            }
        }
    }

    drawCaseZ(paint, c, z, sizeCase){
        const sx = c.screen.x;
        const sy = c.screen.y;
        const cubes = c.cubes;

        if(cubes.length == 0){
            if(z == 0) this.drawDefault(paint, sx, sy, sizeCase);
        } else {
            for(let i = 0; i < cubes.length; i++){
                const cube = cubes[i];
                if(cube != null && cube.z == z)
                    this.drawLayer(paint, cube.floors, cube.floorsSpeed, sx, sy, sizeCase, false);
            }
            for(let i = 0; i < cubes.length; i++){
                const cube = cubes[i];
                if(cube != null && cube.z == z)
                    this.drawLayer(paint, cube.volumes, cube.volumesSpeed, sx, sy, sizeCase, true);
            }
        }
        this.drawEntities(paint, c, z);
    }

    drawEntities(paint, c, z){
        const draws = c.entityDraws;
        for(let i = 0; i < draws.length; i++)
            if(draws[i].z == z)
                this.drawEntity(paint, draws[i]);
    }

    /** Sol de repère là où la carte est vide : indispensable pour éditer dans le vide. */
    drawDefault(paint, sx, sy, sizeCase){
        this.drawLayer(paint, this.control.floorsDefault, 0, sx, sy, sizeCase, false);
    }

    /**
     * Empile les textures d'une couche sur une case.
     * speed > 0 : le lot est une animation, on n'affiche qu'une image, choisie
     * d'après l'horloge, ce qui synchronise toutes les cases entre elles.
     */
    drawLayer(paint, names, speed, sx, sy, sizeCase, volume){
        if(names == null || names.length == 0) return;

        const rectY = volume ? sy - sizeCase : sy;
        const rectHeight = volume ? sizeCase * 2 : sizeCase;

        if(speed > 0){
            const world = this.control.worldMap;
            const time = world == null ? 0 : world.time;
            const i = Math.floor(names.length * ((time % speed) / speed));
            this.drawTexture(paint, names[i], sx - sizeCase, rectY, sizeCase * 2, rectHeight);
            return;
        }
        for(let i = 0; i < names.length; i++)
            this.drawTexture(paint, names[i], sx - sizeCase, rectY, sizeCase * 2, rectHeight);
    }

    drawTexture(paint, name, x, y, width, height){
        const texture = Textures.get(name);
        if(texture == null) return;
        texture.draw(paint, x, y, width, height);
    }

    /** Le rectangle du sprite est déjà calculé par EntityDraw : on le remplit. */
    drawEntity(paint, entityDraw){
        this.drawTexture(paint, entityDraw.sprite,
            entityDraw.screen.x, entityDraw.screen.y,
            entityDraw.width, entityDraw.height);
    }
    /**
     * Grille iso : 4 familles de droites, comme avant.
     * Le losange des cases n'est plus calé sur (0,0) : createCases garde
     * x-y >= -2, x+y >= -2, |x|+|y| <= caseCount*2. Les extrémités suivent.
     */
    drawGrid(){
        const paint = this.Paint;
        const mapview = this.control;
        const pad = 2;
        const last = mapview.caseCount - 1;
        const maxCases = (mapview.caseCount * 2) - 1 + pad;
        const color = "#043296ff";
        const lineWidth = 2;

        for(let x = 0; x <= last + pad; x++){
            let from = mapview.screenFromCase(x - pad, 0 - x);
            let to = mapview.screenFromCase(maxCases - x, 0 - x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = mapview.screenFromCase(x - pad, x + 1);
            to = mapview.screenFromCase(maxCases - x, x + 1);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = mapview.screenFromCase(x - pad, 0 - x);
            to = mapview.screenFromCase(x - pad, x + 1);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = mapview.screenFromCase(last + x + 1, 0 - (last + pad - x));
            to = mapview.screenFromCase(last + x + 1, last + pad + 1 - x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
        }
    }
    drawCaseNumbers(){
        const mapview = this.control;
        const paint = this.Paint;
        const sizeCase = mapview.sizeCase;
        const maxCases = (mapview.caseCount*2);
        const font = { family: "Arial", size: 10, style: "bold", color: "#000" };
        
        for(let x = -maxCases; x <= maxCases; x++){
            for(let y = -maxCases; y <= maxCases; y++){
                const screen = mapview.screenFromCase(x, y);
                const manhattan = Math.abs(x)+Math.abs(y);
                if(x - y >= -2 && x + y >= -2 && manhattan <= maxCases){
                    paint.drawText(screen.x-sizeCase/4, screen.y+sizeCase/2, `${x},${y}`, font);
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
    drawHover(cx, cy){
        const mapview = this.control;
        const paint = this.Paint;
        const sizeCase = mapview.sizeCase;

        const c = mapview.findCase(cx, cy);
        const screen = c != null ? c.screen : mapview.screenFromCase(cx, cy);

        paint.withAlpha(0.35, () => paint.fillLosange(screen.x, screen.y, sizeCase, "#ff0000"));
        paint.strokeLosange(screen.x, screen.y, sizeCase, "#ff0000", 2);
    }
}
