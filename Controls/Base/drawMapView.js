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
        if(mapview.worldMap === null) return;

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

        if(cubes.length === 0){
            if(z === 0) this.drawDefault(paint, sx, sy, sizeCase);
        } else {
            for(let i = 0; i < cubes.length; i++){
                const cube = cubes[i];
                if(cube != null && cube.z === z)
                    this.drawLayer(paint, cube.floors, cube.speed, sx, sy, sizeCase, false);
            }
            for(let i = 0; i < cubes.length; i++){
                const cube = cubes[i];
                if(cube != null && cube.z === z)
                    this.drawWalls(paint, cube, sx, sy, sizeCase);
            }
            for(let i = 0; i < cubes.length; i++){
                const cube = cubes[i];
                if(cube != null && cube.z === z)
                    this.drawLayer(paint, cube.volumes, cube.speed, sx, sy, sizeCase, true);
            }
        }
        this.drawEntities(paint, c, z);
    }

    drawEntities(paint, c, z){
        const draws = c.entityDraws;
        for(let i = 0; i < draws.length; i++)
            if(draws[i].z === z)
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
        const frames = this.frames(names, speed);
        if(frames.length === 0) return;

        const rectY = volume ? sy - sizeCase : sy;
        const rectHeight = volume ? sizeCase * 2 : sizeCase;
        for(let i = 0; i < frames.length; i++)
            this.drawTexture(paint, frames[i], sx - sizeCase, rectY, sizeCase * 2, rectHeight);
    }

    /**
     * Flancs du cube : west à gauche de l'écran, north à droite.
     * Ils montent d'une case au-dessus du losange de sol.
     */
    drawWalls(paint, cube, sx, sy, sizeCase){
        const top = paint.losange(sx, sy - sizeCase, sizeCase);
        const base = paint.losange(sx, sy, sizeCase);
        const west = [top[3], top[2], base[2], base[3]];
        const north = [top[1], top[2], base[2], base[1]];
        const x = sx - sizeCase;
        const y = sy - sizeCase;
        const width = sizeCase * 2;
        const height = sizeCase * 2;
        this.drawFace(paint, cube.west, cube.speed, west, x, y, width, height, "left");
        this.drawFace(paint, cube.north, cube.speed, north, x, y, width, height, "right");
    }

    drawFace(paint, names, speed, points, x, y, width, height, side){
        const frames = this.frames(names, speed);
        for(let i = 0; i < frames.length; i++){
            const texture = Textures.get(frames[i]);
            if(texture === null) continue;
            if(texture.image !== null){
                this.clipFace(paint, points, () => {
                    paint.drawImage(texture.image, x, y, width, height);
                });
                continue;
            }
            const faces = texture.faces;
            let color = texture.color;
            if(faces != null) color = side === "left" ? faces.left : faces.right;
            if(color == null) continue;
            paint.fillPolygon(points, color);
        }
    }

    clipFace(paint, points, action){
        const ctx = paint.context;
        if(ctx == null || typeof action !== "function") return;
        paint.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for(let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.clip();
        action();
        paint.restore();
    }

    /** speed > 0 : une seule image du tableau, calée sur l'horloge du monde. */
    frames(names, speed){
        if(names == null || names.length === 0) return [];
        if(!(speed > 0)) return names;
        const world = this.control.worldMap;
        const time = world === null ? 0 : world.time;
        const i = Math.floor(names.length * ((time % speed) / speed));
        return [names[i]];
    }

    drawTexture(paint, name, x, y, width, height){
        const texture = Textures.get(name);
        if(texture === null) return;
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
        const screen = c !== null ? c.screen : mapview.screenFromCase(cx, cy);

        paint.withAlpha(0.35, () => paint.fillLosange(screen.x, screen.y, sizeCase, "#ff0000"));
        paint.strokeLosange(screen.x, screen.y, sizeCase, "#ff0000", 2);
    }
}
