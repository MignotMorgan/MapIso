import { CoreMapView } from './Base/coreMapView.js';
import { Control } from 'Control/control.js';
import { EntityDraw } from '../entityDraw.js';
import { Point, Location, CasePoint } from '../point.js';
import { Projector } from '../projector.js';
import { Selection } from '../selection.js';

export class MapView extends Control{
    //hideWalls : 0 les murs restent, 1 ils partent avec le plafond
    #hideWalls = 0;
    //following : la caméra colle à l'entité sélectionnée (le pan milieu l'éteint)
    #following = true;

    // Carte voxel (cubes + joueurs + PNJ). Remplace l'ancien PageInfo.Map.
    #worldMap = null;
    //entities : PNJ / objets propres à cette vue (en plus de worldMap.entities)
    #entities = [];
    //entityDraws : Tableau optimisé des entités pour l'affichage
    #entityDraws = [];
    //playerDraws : vues écran des joueurs
    #playerDraws = [];
    //noCeilingZones : Tableau des zones sans plafond pour la visibilité
    #noCeilingZones = [];
    //createCubes : Flag indiquant qu'il faut traiter de nouveaux cubes
    #createCubes = false;
    //rebuildEntityDraws : il faut recréer les EntityDraw (carte, zoom, sprites)
    #rebuildEntityDraws = true;

    //casePoint : case survolée sur la grille isométrique
    #casePoint = new CasePoint();
    /**
     * location : point du monde affiché au coin HAUT-GAUCHE de la vue.
     * Le champ de vision s'ouvre ensuite vers la droite et vers le bas, en
     * losange. Utiliser moveTo() pour la déplacer, afin que la vue se recalcule.
     */
    #location = new Location();
    #panState = {screen: new Point(), adjustment: new Point(), step:25, modified:false, rolled:0};
    #sizeCase = 0;
    #caseCount = 10;
    #modified = false;
    //cases : Tableau des cases 3D visibles à l'écran
    #cases = [];
    //maxZ : Niveau maximum d'affichage en profondeur (altitude)
    #maxZ = 10;
    //floorsDefault : textures dessinées sous les cases vides (repère de l'éditeur)
    #floorsDefault = [];
    //adjusted : si vrai, l'offset sous-case des entités décale leur sprite
    #adjusted = true;
    // Repères du dernier remplissage, pour ne recalculer les colonnes qu'en cas de changement.
    #drawn = {x:NaN, y:NaN, z:NaN, maxZ:-1, hideWalls:-1};
    // Dernière origine écran des cases : si le contrôle bouge, les sols doivent suivre.
    #placed = {x:NaN, y:NaN, sizeCase:0};
    #projector = null;
    #selection = null;

    constructor(){
        super();
        this.#projector = new Projector(this);
        this.#selection = new Selection(this);
    }

    initialize(){
        super.initialize();
        this.customTheme.background.color = "transparent";
        this.customTheme.background.rectangle.lineWidth = 0;
        this.rebuild();
    }
    /**
     * Un tour de boucle : on ne refait que ce qui a changé.
     * Les colonnes de cubes ne bougent que si la caméra ou la carte bouge ;
     * les entités, elles, sont replacées à chaque image puisqu'elles marchent.
     */
    tick(){
        super.tick();
        if(this.#modified)
            this.rebuild();

        if(this.#worldMap != null){
            const moved = this.#worldMap.tick();
            const selectedId = this.selected.id;
            if(selectedId !== "")
                for(let i = 0; i < moved.length; i++)
                    if(moved[i].id === selectedId){
                        this.noCeilingFromSelected();
                        break;
                    }
        }
        // La caméra d'abord : sinon createCubes se fait sur l'ancienne
        // location, et l'image suivante recolle — un glitch d'une frame.
        if(this.#following) this.followSelected();

        if(this.viewChanged()) this.#createCubes = true;
        if(this.#createCubes){
            this.createCubes();
            this.#createCubes = false;
        }
        if(this.#rebuildEntityDraws){
            this.createEntityDraws();
            this.#rebuildEntityDraws = false;
        }
        this.placeCases();
        this.placeEntityDraws();
    }
    /** La caméra ou le mode d'affichage ont-ils bougé depuis le dernier remplissage ? */
    viewChanged(){
        const drawn = this.#drawn;
        const location = this.#location;
        if(drawn.x === location.x && drawn.y === location.y && drawn.z === location.z
            && drawn.maxZ === this.#maxZ && drawn.hideWalls === this.#hideWalls) return false;
        drawn.x = location.x;
        drawn.y = location.y;
        drawn.z = location.z;
        drawn.maxZ = this.#maxZ;
        drawn.hideWalls = this.#hideWalls;
        return true;
    }
    /** Déplace la caméra. Le monde sous la vue est recalculé au prochain tour. */
    moveTo(wx, wy, wz = this.#location.z){
        this.#location.set(wx, wy, wz);
        this.#createCubes = true;
    }
    /**
     * Glisse la carte de (dx, dy) pixels. L'offset passe par panState
     * (le projecteur), puis se convertit en cases dès qu'il dépasse une maille.
     */
    pan(dx, dy){
        const adjustment = this.#panState.adjustment;
        adjustment.x += dx ?? 0;
        adjustment.y += dy ?? 0;
        this.#foldPan();
    }
    /** Place un point du monde au centre de la vue. */
    lookAt(wx, wy, wz = this.#location.z){
        this.#centerOn(this.screenFromLocation(wx, wy, wz));
    }
    /** Caméra sur l'entité choisie : le sprite interpolé, pas la case logique. */
    followSelected(){
        const entity = this.selectedEntity();
        if(entity == null) return;
        const stride = entity.stride();
        const screen = stride == null
            ? this.screenFromLocation(entity.x, entity.y, entity.z)
            : stride.between(
                this.screenFromLocation(stride.from.x, stride.from.y, stride.from.z),
                this.screenFromLocation(stride.to.x, stride.to.y, stride.to.z));
        this.#centerOn(screen);
    }
    /**
     * Recale pour que ce point écran tombe au centre du contrôle.
     * Le centre est le rectangle du MapView, pas origin() : sinon l'offset
     * de pan est déjà dans la cible, l'erreur revient chaque image et la
     * caméra tremble.
     */
    #centerOn(screen){
        const rect = this.Rectangle.rectangleBackground();
        const dx = rect.x + rect.width / 2 - screen.x;
        const dy = rect.y + rect.height / 2 - screen.y;
        if(dx * dx + dy * dy < 1) return;
        this.pan(dx, dy);
    }
    /**
     * Un décalage écran trop grand devient un déplacement de location :
     * les cubes hors vue se chargent, le reste (panState) reste un sous-case.
     */
    #foldPan(){
        const sizeCase = this.#sizeCase;
        if(!(sizeCase > 0)) return;
        const adjustment = this.#panState.adjustment;
        const shiftX = Math.trunc((-adjustment.x - 2 * adjustment.y) / (2 * sizeCase));
        const shiftY = Math.trunc((adjustment.x - 2 * adjustment.y) / (2 * sizeCase));
        if(shiftX === 0 && shiftY === 0) return;
        this.moveTo(this.#location.x + shiftX, this.#location.y + shiftY);
        adjustment.x -= sizeCase * (shiftY - shiftX);
        adjustment.y += (sizeCase / 2) * (shiftX + shiftY);
    }
    get casePoint(){ return this.#casePoint; }
    // On recopie dans le point existant : la vue garde le sien, personne ne
    // peut lui glisser un objet d'une autre forme à la place.
    set casePoint(value){ this.#casePoint.copy(value); }
    get location(){ return this.#location; }
    get projector(){ return this.#projector; }
    get selection(){ return this.#selection; }
    get panState(){ return this.#panState; }
    get sizeCase(){ return this.#sizeCase; }
    get caseCount(){ return this.#caseCount; }
    set caseCount(value){ 
        value < 1 ? value = 1 : this.#caseCount = value; 
        this.invalidate();
    }

    get cases(){ return this.#cases; }
    set cases(value){ this.#cases = value; }
    get maxZ(){ return this.#maxZ; }
    set maxZ(value){ this.#maxZ = value; }
    get floorsDefault(){ return this.#floorsDefault; }
    set floorsDefault(value){ this.#floorsDefault = value || []; }
    get adjusted(){ return this.#adjusted; }
    set adjusted(value){ this.#adjusted = !!value; this.#rebuildEntityDraws = true; }


    get following(){ return this.#following; }
    set following(value){ this.#following = !!value; }
    get hideWalls(){ return this.#hideWalls; }
    set hideWalls(value){ this.#hideWalls = value ?? 0; }
    get selected(){ return this.#selection.selected; }
    get target(){ return this.#selection.target; }
    get selectedMulti(){ return this.#selection.selectedMulti; }
    get selectedMouse(){ return this.#selection.selectedMouse; }
    get worldMap(){ return this.#worldMap; }
    /** Brancher une carte suffit : la vue se remplit toute seule au tour suivant. */
    set worldMap(value){
        this.#worldMap = value ?? null;
        this.#noCeilingZones = [];
        this.#createCubes = true;
        this.#rebuildEntityDraws = true;
    }
    get entities(){ return this.#entities; }
    get entityDraws(){ return this.#entityDraws; }
    get playerDraws(){ return this.#playerDraws; }
    get noCeilingZones(){ return this.#noCeilingZones; }
    get createCubes(){ return this.#createCubes; }
    get rebuildEntityDraws(){ return this.#rebuildEntityDraws; }

    invalidate(){ this.#modified = true; }
    rebuild(){
        this.#sizeCase = this.sizeCaseFrame();
        this.createCases();
        this.#modified = false;
        this.#createCubes = true;
        this.#rebuildEntityDraws = true;   // la taille des sprites dépend de sizeCase
    }

    newCase(cx, cy){
        const c = CoreMapView.FactoryWorld.createCase(cx, cy);
        c.screen = this.screenFromCase(cx, cy);
        return c;
    }
    sizeCaseFrame(){
        return (this.origin().width / this.caseCount) / 2;
    }
    origin(){ return this.#projector.origin(); }
    mouseFromScreen(){ return this.#projector.mouseFromScreen(); }
    caseFromMouse(){ return this.#projector.caseFromMouse(); }
    caseFromScreen(sx, sy){ return this.#projector.caseFromScreen(sx, sy); }
    screenFromCase(cx, cy){ return this.#projector.screenFromCase(cx, cy); }
    caseFromLocation(wx, wy, wz){ return this.#projector.caseFromLocation(wx, wy, wz); }
    screenFromLocation(wx, wy, wz){ return this.#projector.screenFromLocation(wx, wy, wz); }
    createCases(){
        const maxCases = this.caseCount*2;
        this.cases = [];
        for(let x = -maxCases; x <= maxCases; x++){
            for(let y = -maxCases; y <= maxCases; y++){
                const manhattan = Math.abs(x)+Math.abs(y);
                if(x - y >= -2 && x + y >= -2 && manhattan <= maxCases){
                    const c = this.newCase(x, y);
                    this.cases.push(c);
                }
            }
        }
        // Fond → avant (x+y), puis gauche → droite (x-y) sur une même diagonale.
        this.cases.sort((a, b) => {
            const depth = (a.x + a.y) - (b.x + b.y);
            if(depth !== 0) return depth;
            return (a.x - a.y) - (b.x - b.y);
        });
        this.#placed.x = NaN;
        this.#placed.y = NaN;
    }

    /**
     * Recale chaque case sur le rectangle actuel du contrôle.
     * createCases ne le fait qu'une fois : un déplacement de MapView
     * change origin() sans recréer la grille, donc les sols resteraient
     * collés à l'ancienne origine alors que les entités, replacées
     * chaque image, suivraient le contrôle.
     */
    placeCases(){
        const origin = this.origin();
        const placed = this.#placed;
        if(placed.x === origin.x && placed.y === origin.y && placed.sizeCase === this.#sizeCase)
            return;
        placed.x = origin.x;
        placed.y = origin.y;
        placed.sizeCase = this.#sizeCase;

        for(let i = 0; i < this.#cases.length; i++){
            const c = this.#cases[i];
            c.screen = this.screenFromCase(c.x, c.y);
        }
    }


    
    /**
     * Remplit chaque case visible avec la colonne de cubes monde.
     * wx/wy : origine caméra + offset case, moins z caméra (parallaxe).
     * À z croissant on ajoute z à x et y : un étage « recule » en iso.
     */
    createCubes()
    {
        if(this.worldMap == null) return;
        for(let i = 0; i < this.cases.length; i++)
        {
            const c = this.cases[i];
            c.cubes = [];
            const wx = this.location.x + c.x - this.location.z;
            const wy = this.location.y + c.y - this.location.z;
            let cube;

            for (let z = 0; z <= this.maxZ; z++)
            {
                cube = this.findCube(wx + z, wy + z, z);
                if(cube != null && !this.hidesCeiling(cube.x, cube.y, cube.z))
                        c.cubes[c.cubes.length] = cube;
            }

        }
    }

    /** PNJ et objets : ceux de la carte, plus ceux propres à cette vue. */
    npcs(){
        const npcs = this.worldMap == null ? [] : this.worldMap.entities;
        if(this.#entities.length === 0) return npcs;
        return npcs.concat(this.#entities);
    }

    /**
     * Construit la vue écran des entités (taille du sprite, ancrage).
     * Opération lourde : on ne la refait qu'au changement de carte ou de zoom,
     * pas à chaque image.
     */
    createEntityDraws(){
        const sizeCase = this.sizeCase;
        const players = this.worldMap == null ? [] : this.worldMap.players;
        const npcs = this.npcs();

        this.#playerDraws = [];
        for(let i = 0; i < players.length; i++)
            if(players[i] != null)
                this.#playerDraws[this.#playerDraws.length] = new EntityDraw(players[i], sizeCase, this.#adjusted);

        this.#entityDraws = [];
        for(let i = 0; i < npcs.length; i++)
            if(npcs[i] != null)
                this.#entityDraws[this.#entityDraws.length] = new EntityDraw(npcs[i], sizeCase, this.#adjusted);
    }

    /**
     * Range chaque sprite dans la case qu'il occupe.
     * Le monde a déjà tick : ici on ne fait que l'écran.
     */
    placeEntityDraws(){
        for(let i = 0; i < this.#cases.length; i++)
            this.#cases[i].entityDraws = [];

        this.placeDraws(this.#playerDraws);
        this.placeDraws(this.#entityDraws);
    }
    placeDraws(draws){
        for(let i = 0; i < draws.length; i++){
            const draw = draws[i];
            const entity = draw.entity;

            const stride = entity.stride();
            if(stride == null){
                draw.toScreen(this.screenFromLocation(entity.x, entity.y, entity.z));
                draw.z = entity.z;
                const c = this.findCaseLocation(entity.x, entity.y, entity.z);
                if(c != null) c.entityDraws[c.entityDraws.length] = draw;
            } else {
                // Pieds interpolés en x,y ; l'étage du peintre est celui qu'elle occupe
                // (l'arrivée). Sinon une montée la range au sol et le gazon de
                // devant la recouvre.
                draw.toScreen(stride.between(
                    this.screenFromLocation(stride.from.x, stride.from.y, stride.from.z),
                    this.screenFromLocation(stride.to.x, stride.to.y, stride.to.z)));
                const at = stride.at();
                draw.z = entity.z;
                const c = this.findCaseLocation(at.x, at.y, entity.z);
                if(c != null) c.entityDraws[c.entityDraws.length] = draw;
            }
        }
    }

    select(id){
        const entity = this.#selection.select(id);
        if(entity != null) this.#following = true;
        return entity;
    }
    moveSelectedTo(cube){ return this.#selection.moveSelectedTo(cube); }
    onSelectedMouse(){ this.#selection.onSelectedMouse(); }
    onTarget(){ this.#selection.onTarget(); }
    selectedMultiDown(){ this.#selection.selectedMultiDown(); }
    selectedMultiUp(){ this.#selection.selectedMultiUp(); }
    selectedMultiMove(){ this.#selection.selectedMultiMove(); }
    selectedEntity(){ return this.#selection.selectedEntity(); }
    selectedTarget(){ return this.#selection.selectedTarget(); }
    containsEntity(entity, wx, wy, wz){ return this.#selection.contains(entity, wx, wy, wz); }

    /**
     * Recalcule les pièces dont il faut masquer le plafond, d'après l'entité
     * sélectionnée. Aucune sélection = on remet tous les plafonds.
     */
    noCeilingFromSelected(){
        const entity = this.selectedEntity();
        if(entity == null) this.#noCeilingZones = [];
        else this.noCeilingFrom(entity.x, entity.y, entity.z);
    }
    /** Pièces contenant ce point : c'est la carte qui sait, on lui demande. */
    noCeilingFrom(wx, wy, wz){
        this.#noCeilingZones = this.worldMap == null ? [] : this.worldMap.zonesAt(wx, wy, wz);
        this.#createCubes = true;
    }
    /** Ce cube fait-il partie d'un plafond à masquer ? hideWalls décide du sort des murs. */
    hidesCeiling(wx, wy, wz){
        for(let i = 0; i < this.#noCeilingZones.length; i++)
            if(this.#noCeilingZones[i].hides(wx, wy, wz, this.#hideWalls)) return true;
        return false;
    }
    /**
     * Cube du monde. On demande à la carte au lieu de fouiller sa grille :
     * MapView ignore ainsi comment les cubes sont rangés, et pourra afficher
     * aussi bien une carte unique qu'un assemblage de cartes.
     */
    findCube(wx, wy, wz){
        if(this.worldMap == null) return null;
        return this.worldMap.cubeAt(wx, wy, wz);
    }
    /** Ce point fait-il partie du monde ? (différent de « la donnée est chargée »). */
    inWorld(wx, wy, wz, worldMap = this.worldMap){
        if(worldMap == null) return false;
        return worldMap.inBounds(wx, wy, wz);
    }
    /** Case du viewport (losange affiché), pas un cube monde. */
    findCase(cx, cy){
        for(let i = 0; i < this.cases.length; i++)
            if ( this.cases[i].x == cx && this.cases[i].y == cy)
                return this.cases[i];
        return null;    
    }
    /** Monde → case visible, via le projecteur (même parallaxe que l'écran). */
    findCaseLocation(wx, wy, wz){
        const casePoint = this.#projector.caseFromLocation(wx, wy, wz);
        return this.findCase(casePoint.x, casePoint.y);
    }
    /** Habitants de la carte d'abord, puis les entités propres à cette vue. */
    findEntity(id){
        if(id == null || id === "") return null;

        if(this.worldMap != null){
            const entity = this.worldMap.findEntity(id);
            if(entity != null) return entity;
        }

        for(let i = 0; i < this.entities.length; i++)
            if(id === this.entities[i].id)
                return this.entities[i];
    
        return null;
    }

}
