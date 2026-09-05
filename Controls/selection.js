import { Pathfinding } from '../Pathfinding.js';

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

    #view = null;
    #selected = { ID:"", Multi:[], Target:"" };
    #target = {id:"", case:null, cube:null};
    #selectedMulti = { Source:{X:0,Y:0}, Destination:{X:0,Y:0}, Active:false };
    #selectedMouse = {power:null, target:"", x:0, y:0, z:0, range:3};

    constructor(view){
        this.#view = view;
    }

    get view(){ return this.#view; }
    get selected(){ return this.#selected; }
    get target(){ return this.#target; }
    get selectedMulti(){ return this.#selectedMulti; }
    get selectedMouse(){ return this.#selectedMouse; }

    selectedEntity(){ return this.#view.findEntityID(this.#selected.ID); }
    selectedTarget(){ return this.#view.findEntityID(this.#selected.Target); }

    /** Choisit une entité. La vue met à jour les plafonds à masquer. */
    select(id){
        this.#selected.ID = id ?? "";
        this.#view.noCeilingFromSelected();
        return this.selectedEntity();
    }

    /** Envoie l'entité choisie vers un cube. False si rien n'est choisi ou si le trajet est impossible. */
    moveSelectedTo(cube){
        const view = this.#view;
        if(cube == null || view.map == null) return false;
        const entity = this.selectedEntity();
        if(entity == null) return false;
        return new Pathfinding(entity.x, entity.y, entity.z, view.map)
                    .moveTo(entity, cube.x, cube.y, cube.z);
    }

    /**
     * Clic : case, sol, et entité sous le curseur (rectangle du sprite).
     */
    onTarget(){
        const view = this.#view;
        const C2D = view.findCase(view.case.x, view.case.y);
        this.#target.case = C2D;
        this.#target.cube = C2D != null ? C2D.toFloors() : null;
        this.#target.id = this.#hitSprite(view.permanentsDraw.concat(view.entitysDraw));
    }

    /**
     * Visée à portée : cube (ou terrain) sous le curseur, borné à range
     * cases de l'entité choisie, puis cible 3D ou rectangle de sprite.
     */
    onSelectedMouse(){
        const view = this.#view;
        const pointed = view.caseFromMouse();
        const C2D = pointed == null ? null : view.findCase(pointed.x, pointed.y);
        let x = 0;
        let y = 0;
        let z = 0;

        if(C2D != null && C2D.cubes.length > 0){
            const top = C2D.cubes[C2D.cubes.length - 1];
            x = top.x;
            y = top.y;
            z = top.z;
        } else {
            x = view.location.x + view.case.x;
            y = view.location.y + view.case.y;
            z = view.location.z;
        }

        if(this.#selected.ID !== "" && this.#selectedMouse.range > 0){
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

        if(view.map == null) return;

        this.#selectedMouse.target = "";
        let target = this.#hitVolume(view.map.permanents, x, y, z);
        if(target == null) target = this.#hitVolume(view.mobiles(), x, y, z);

        this.#selectedMouse.target = target != null ? target.id : this.#hitSprite(view.entitysDraw);
    }

    selectedMulti_Down(){
        const multi = this.#selectedMulti;
        const inside = this.#view.mouseFromScreen();
        multi.Active = true;
        this.#selected.Multi = [];
        multi.Source.X = inside.x;
        multi.Source.Y = inside.y;
        multi.Destination.X = inside.x;
        multi.Destination.Y = inside.y;
    }

    selectedMulti_Up(){
        this.#selectedMulti.Active = false;
    }

    /** Toute EntityDraw dont le sprite coupe le rectangle. */
    selectedMulti_Move(){
        const selected = this.#selected;
        const multi = this.#selectedMulti;
        const inside = this.#view.mouseFromScreen();
        selected.Multi = [];
        multi.Destination.X = inside.x;
        multi.Destination.Y = inside.y;

        const draws = this.#view.entitysDraw;
        for(let i = 0; i < draws.length; i++){
            const draw = draws[i];
            if(!Selection.#overlaps(multi, draw)) continue;
            selected.Multi[selected.Multi.length] = draw.id;
        }
    }

    /**
     * Point 3D dans le volume d'une entité.
     * Délègue à Entity.contains ; sinon lit width/x camelCase ou PascalCase.
     */
    contains(entity, pX, pY, pZ){
        if(entity == null) return false;
        if(typeof entity.contains === "function") return entity.contains(pX, pY, pZ);
        const width = entity.width ?? entity.Width;
        const height = entity.height ?? entity.Height;
        const x = entity.x ?? entity.X;
        const y = entity.y ?? entity.Y;
        const z = entity.z ?? entity.Z;
        return (pX <= x) && (pX > x - width)
            && (pY <= y) && (pY > y - width)
            && (pZ >= z) && (pZ < z + height);
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
        const mouse = this.#view.mouseFromScreen();
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
        const left = Math.min(multi.Source.X, multi.Destination.X);
        const right = Math.max(multi.Source.X, multi.Destination.X);
        const top = Math.min(multi.Source.Y, multi.Destination.Y);
        const bottom = Math.max(multi.Source.Y, multi.Destination.Y);
        if(draw.screen.x > right) return false;
        if(draw.screen.x + draw.width < left) return false;
        if(draw.screen.y > bottom) return false;
        if(draw.screen.y + draw.width < top) return false;
        return true;
    }
}
