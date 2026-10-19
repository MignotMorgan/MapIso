import { Point } from './point.js';

/**
 * La sélection sur la carte.
 *
 * Ce n'est pas la vue : un éditeur et un jeu partagent la même caméra,
 * pas les mêmes règles de clic. Cet objet tient qui est choisi, ce qui
 * est sous le curseur, le rectangle de multi-sélection, et la visée
 * à portée limitée. Il demande à la vue les cases, les sprites et
 * les habitants ; il ne les range pas lui-même.
 */
export class Selection{

    #mapView = null;
    #selected = { id:"", multi:[], target:"" };
    #target = {id:"", case:null, cube:null};
    #selectedMulti = { source: new Point(), destination: new Point(), active:false };
    #selectedMouse = {power:null, target:"", x:0, y:0, z:0, range:3};

    constructor(mapView){
        this.#mapView = mapView;
    }

    get mapView(){ return this.#mapView; }
    get selected(){ return this.#selected; }
    get target(){ return this.#target; }
    get selectedMulti(){ return this.#selectedMulti; }
    get selectedMouse(){ return this.#selectedMouse; }

    selectedEntity(){ return this.#mapView.findEntity(this.#selected.id); }
    selectedTarget(){ return this.#mapView.findEntity(this.#selected.target); }

    /** Choisit une entité. La vue met à jour les plafonds à masquer. */
    select(id){
        this.#selected.id = id ?? "";
        this.#mapView.noCeilingFromSelected();
        return this.selectedEntity();
    }

    /** Intention « aller ici » : la carte pathfind, pas la vue. */
    moveSelectedTo(cube){
        const mapView = this.#mapView;
        if(cube == null || mapView.worldMap == null) return false;
        const entity = this.selectedEntity();
        if(entity == null) return false;
        return mapView.worldMap.goTo(entity.id, cube.x, cube.y, cube.z);
    }

    /**
     * Clic : case, sol, et entité sous le curseur (rectangle du sprite).
     */
    onTarget(){
        const mapView = this.#mapView;
        const c = mapView.findCase(mapView.casePoint.x, mapView.casePoint.y);
        this.#target.case = c;
        this.#target.cube = c != null ? c.floor() : null;
        this.#target.id = this.#hitSprite(mapView.playerDraws.concat(mapView.entityDraws));
    }

    /**
     * Visée à portée : cube (ou terrain) sous le curseur, borné à range
     * cases de l'entité choisie, puis cible 3D ou rectangle de sprite.
     */
    onSelectedMouse(){
        const mapView = this.#mapView;
        const pointed = mapView.caseFromMouse();
        const c = pointed == null ? null : mapView.findCase(pointed.x, pointed.y);
        let x = 0;
        let y = 0;
        let z = 0;

        if(c != null && c.cubes.length > 0){
            const top = c.cubes[c.cubes.length - 1];
            x = top.x;
            y = top.y;
            z = top.z;
        } else {
            x = mapView.location.x + mapView.casePoint.x;
            y = mapView.location.y + mapView.casePoint.y;
            z = mapView.location.z;
        }

        if(this.#selected.id !== "" && this.#selectedMouse.range > 0){
            const entity = this.selectedEntity();
            if(entity != null){
                x = Selection.#clamp(x, entity.x, this.#selectedMouse.range);
                y = Selection.#clamp(y, entity.y, this.#selectedMouse.range);
                z = Selection.#clamp(z, entity.z, this.#selectedMouse.range);
            }
        }

        this.#selectedMouse.x = x;
        this.#selectedMouse.y = y;
        this.#selectedMouse.z = z;

        if(mapView.worldMap == null) return;

        this.#selectedMouse.target = "";
        let target = this.#hitVolume(mapView.worldMap.players, x, y, z);
        if(target == null) target = this.#hitVolume(mapView.mobiles(), x, y, z);

        this.#selectedMouse.target = target != null ? target.id : this.#hitSprite(mapView.entityDraws);
    }

    selectedMultiDown(){
        const multi = this.#selectedMulti;
        const inside = this.#mapView.mouseFromScreen();
        multi.active = true;
        this.#selected.multi = [];
        multi.source.set(inside.x, inside.y);
        multi.destination.set(inside.x, inside.y);
    }

    selectedMultiUp(){
        this.#selectedMulti.active = false;
    }

    /** Toute EntityDraw dont le sprite coupe le rectangle. */
    selectedMultiMove(){
        const selected = this.#selected;
        const multi = this.#selectedMulti;
        const inside = this.#mapView.mouseFromScreen();
        selected.multi = [];
        multi.destination.set(inside.x, inside.y);

        const draws = this.#mapView.entityDraws;
        for(let i = 0; i < draws.length; i++){
            const draw = draws[i];
            if(!Selection.#overlaps(multi, draw)) continue;
            selected.multi[selected.multi.length] = draw.id;
        }
    }

    /**
     * Point 3D dans le volume d'une entité.
     * Délègue à Entity.contains.
     */
    contains(entity, x, y, z){
        if(entity == null) return false;
        if(typeof entity.contains === "function") return entity.contains(x, y, z);
        return false;
    }

    #hitVolume(list, x, y, z){
        if(list == null) return null;
        let target = null;
        for(let i = 0; i < list.length; i++){
            const entity = list[i];
            if(entity != null && entity.canTarget && this.contains(entity, x, y, z))
                target = entity;
        }
        return target;
    }

    #hitSprite(draws){
        const mouse = this.#mapView.mouseFromScreen();
        const mx = mouse.x;
        const my = mouse.y;
        for(let i = 0; i < draws.length; i++){
            const draw = draws[i];
            if(draw.screen.x < mx && mx < draw.screen.x + draw.width
                && draw.screen.y < my && my < draw.screen.y + draw.height)
                return draw.id;
        }
        return "";
    }

    static #clamp(value, center, range){
        if(value - center > range) return center + range;
        if(value - center < -range) return center - range;
        return value;
    }

    static #overlaps(multi, draw){
        const left = Math.min(multi.source.x, multi.destination.x);
        const right = Math.max(multi.source.x, multi.destination.x);
        const top = Math.min(multi.source.y, multi.destination.y);
        const bottom = Math.max(multi.source.y, multi.destination.y);
        if(draw.screen.x > right) return false;
        if(draw.screen.x + draw.width < left) return false;
        if(draw.screen.y > bottom) return false;
        if(draw.screen.y + draw.height < top) return false;
        return true;
    }
}
