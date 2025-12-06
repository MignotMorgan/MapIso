import { Core } from 'Control/core.js';
import { CoreIso } from './coreIso.js';
import { Form, DrawForm, FactoryForm } from 'Control/form.js';
import { Control } from 'Control/control.js';
import { Draw } from 'Control/draw.js'; 
import { Factory } from 'Control/factory.js'
import { Mouse } from 'Control/input.js';
import { Resize, Scale } from 'Control/transformation.js';
import { Case } from './case.js';

export class MapIso extends Control{
    //grap : Gestion du déplacement de la vue ("grab" pour saisir/déplacer) 
     #grap = {x:0, y:0, adjustment:{x:0,y:0}, border:25, step:25, modified:false, rolled:0};
    //wallCeil : Mode d'affichage des murs et plafonds
    #wallCeil = 0;    
    //selected : Gestion des entités sélectionnées par le joueur
    #selected = { ID:"", Multi:[], Target:"" };   
    //target : Cible actuelle sous le curseur de la souris
    #target = {id:"", case:null, cube:null};
    //selectedMulti : Gestion de la sélection multiple par glisser-déposer
    #selectedMulti = { Source:{X:0,Y:0}, Destination:{X:0,Y:0}, Active:false };
    //selectedMouse : Gestion des pouvoirs/actions avec limitation de portée.
    #selectedMouse = {power:null, target:"",x:0,y:0,z:0, range:3};

    //entitys : Tableau des entités dynamiques (personnages, objets mobiles)
    #entitys = new Array();
    //entitysDraw : Tableau optimisé des entités pour l'affichage
    #entitysDraw = new Array();
    //permanentsDraw : Tableau des entités permanentes pour l'affichage
    #permanentsDraw = [];
    //temporyCubes : Buffer temporaire pour les nouveaux cubes reçus du serveur
    #temporyCubes = new Array();
    //temporyEntitys : Buffer temporaire pour un ensemble complet d'entités
    #temporyEntitys = null;
    //temporyEntity : Buffer temporaire pour les entités individuelles
    #temporyEntity = new Array();
    //noCeiling : Tableau des zones sans plafond pour la visibilité
    #noCeiling = new Array();
    //resizeCases : Flag indiquant qu'il faut recalculer toutes les cases
    //#resizeCases = true;
    //createCase : Flag indiquant qu'il faut recréer le contenu des cases
    #createCase = false;
    //createCubes : Flag indiquant qu'il faut traiter de nouveaux cubes
    #createCubes = false;
    //createEntityDraw : Flag indiquant qu'il faut recalculer l'affichage des entités
    #createEntityDraw = true;


    //case : Représente la position d'une case sur la grille isométrique
    #case = {x:0,y:0, adjustment:{x:0,y:0}};
    //location : Position de la caméra/vue dans le monde 3D
    #location = {x:-25,y:-5,z:0};
    #frame = {x:100, y:200, width:600, height:300};
    #revise = {screen:{x:0, y:0}, adjustment:{x:0,y:0}, step:25, modified:false, rolled:0};
    #sizeCase;
    #nbrCases= 10;
    #modified = false;
    //#colsCase;
    //#rowsCase;
    //cases : Tableau des cases 3D visibles à l'écran
    #cases = [];
    //maxZ : Niveau maximum d'affichage en profondeur (altitude)
    #maxZ = 10;
    constructor(){
        super();
        //this.nbrCases = 10;
        //this.#sizeCase = 3;
        //this.#colsCase = 20;
        //this.#rowsCase = 20;
    }

    initialize(){
        super.initialize();
        this.#sizeCase = this.sizeCaseFrame(); 
        this.createCases();
    }
    tick(){
        super.tick();
        if(this.#modified)
            this.modify();
    }

    get case(){ return this.#case; }
    set case(value){ this.#case = value; }
    get location(){ return this.#location; }
    get frame(){ return this.#frame; } //Supprimer!!
    get revise(){ return this.#revise; }
    get sizeCase(){ return this.#sizeCase; }
    get nbrCases(){ return this.#nbrCases; }
    set nbrCases(value){ 
        value < 1 ? value = 1 : this.#nbrCases = value; 
        this.#sizeCase = this.sizeCaseFrame(); 
    }

    //set sizeCase(value){ this.#sizeCase = value; }
    //get colsCase(){ return this.#colsCase; }
    //get rowsCase(){ return this.#rowsCase; }
    get cases(){ return this.#cases; }
    set cases(value){ this.#cases = value; }
    get maxZ(){ return this.#maxZ; }
    set maxZ(value){ this.#maxZ = value; }


    get grap(){ return this.#grap; }
    get wallCeil(){ return this.#wallCeil; }
    get selected(){ return this.#selected; }
    get target(){ return this.#target; }
    get selectedMulti(){ return this.#selectedMulti; }
    get selectedMouse(){ return this.#selectedMouse; }
    //get cases3D(){ return this.#cases3D; }
    get entitys(){ return this.#entitys; }
    get entitysDraw(){ return this.#entitysDraw; }
    get permanentsDraw(){ return this.#permanentsDraw; }
    get temporyCubes(){ return this.#temporyCubes; }
    get temporyEntitys(){ return this.#temporyEntitys; }
    get temporyEntity(){ return this.#temporyEntity; }
    get noCeiling(){ return this.#noCeiling; }
    //get resizeCases(){ return this.#resizeCases; }
    get createCase(){ return this.#createCase; }
    get createCubes(){ return this.#createCubes; }
    get createEntityDraw(){ return this.#createEntityDraw; }

    modified(){ this.#modified = true; }
    modify(){
        this.#sizeCase = this.sizeCaseFrame(); 
    }

    newCase(x, y ){
        const c = new Case(x, y);
        c.screen = this.screenFromCase(x, y );
        return c;
    }
    fakeCase(){
        return { x : 0, y : 0, adjustment : { x : 0, y : 0 } };
    }
    nbrCasesFrame(){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        const width = redressed.width;
        return Math.round(width/sizeCase/2);
    }
    sizeCaseFrame(){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        const width = redressed.width;
        return (width/this.nbrCases)/2;
    }
    redress(){
        const redressed = {x:0, y:0, width:0, height:0};
        const rect = this.Rectangle.rectangleBackground();
        redressed.x = rect.x + this.#revise.adjustment.x;
        redressed.y = rect.y + this.#revise.adjustment.y;
        redressed.width = rect.width;
        redressed.height = rect.height;
        //console.log(redressed);
        return redressed;
    }
    caseFromMouse(){
        const inside = this.Mouse.inside();
        // Coordonnées relatives au coin haut-gauche du contrôle
        //const x = inside.x - this.Border.left;
        //const y = inside.y - this.Border.top;
        //const x = this.Absolute.x - this.Border.left;
        //const y = this.Absolute.y - this.Border.top;
        const x = Core.mouse.x - this.form.Inside.x;// - this.form.Border.left;
        const y = Core.mouse.y - this.form.Inside.y;// - this.form.Border.top;
        return this.caseFromScreen(x, y);
    };
    caseFromScreen2(x, y){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        let c = this.fakeCase();

        x -= (redressed.x + sizeCase);
        y -= redressed.y;

        x = ((x/sizeCase)*100);
        y = ((y/sizeCase)*100);
        //y = ((y-(sizeCase/2))/sizeCase)*100;  

        let pY = ((2*y-x)/2);
        let pX = (x+pY);
    
        c.y = Math.round(pY/100);
        c.x = Math.round(pX/100);
    
        c.adjustment.x = Math.round(x-((c.x-c.y)*100));
        c.adjustment.y = Math.round(y-((c.x+c.y)*50));

        return c;
    };
    caseFromScreen(x, y){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        let c = this.fakeCase();

        x -= (redressed.x + sizeCase);
        y -= redressed.y;
        y -= (sizeCase/2);

        x = ((x/sizeCase)*100);
        y = ((y/sizeCase)*100);
        //y = ((y-(sizeCase/2))/sizeCase)*100;  

        let pY = ((2*y-x)/2);
        let pX = (x+pY);
    
        c.y = Math.round(pY/100);
        c.x = Math.round(pX/100);
    
        c.adjustment.x = Math.round(x-((c.x-c.y)*100));
        c.adjustment.y = Math.round(y-((c.x+c.y)*50));

        return c;
    };
    screenFromCase(x, y){
        const sizeCase = this.sizeCase;
        const redressed = this.redress();
        
        return {
            x: ((x - y) * sizeCase) + redressed.x + sizeCase,
            y: ((x + y) * sizeCase / 2) + redressed.y
        };
    };
 
    //A faire!!!
    caseFromLocation(x, y, z){
        const c = this.fakeCase();
        return c;
    }

    screenFromLocation(x, y, z){
        const sizeCase = this.sizeCase;
        const c = this.fakeCase();
        const screen = {x:0,y:0};
        // === CALCUL DES COORDONNÉES RELATIVES À LA CAMÉRA ===
    
    /**
     * Coordonnée X relative avec correction de parallaxe :
     * - (L_X - Location.X) : position relative à la caméra
     * - (L_Z - Location.Z) : correction de la parallaxe verticale
     */
        c.x = x - this.location.x - (z - this.location.z);
    
    /**
     * Coordonnée Y relative avec correction de parallaxe :
     * Même principe que pour X
     */
        c.y = y - this.location.y - (z - this.location.z);
    
    // === CONVERSION EN COORDONNÉES ÉCRAN ===
    
    // Application des formules isométriques standard
        screen.x = parseInt((c.x - c.y) * sizeCase);
        screen.y = parseInt((c.x + c.y) * sizeCase / 2);
    
    // Décalage horizontal d'un cube pour le centrage de l'affichage
        screen.x += sizeCase;
        return screen;
    };
    createCases(){
        const maxCases = this.nbrCases*2;
        this.cases = [];
        for(let x = 0-maxCases; x <= maxCases; x++){
            for(let y = 0-maxCases; y <= maxCases; y++){
                const abs = Math.abs(x)+Math.abs(y);
                if(x - y >= -2 && x + y >= -2 && abs <= maxCases){
                    const c = this.newCase(x, y);
                    this.cases.push(c);
                }
            }
        }
    }


    
    createCubes()
    {
        if(PageInfo.Map == null)return;
        for(let i = 0; i < this.cases.length; i++)
        {
            const C2D = this.cases[i];
            C2D.cubes = [];
            const px = this.location.x + C2D.x - this.location.z;
            const py = this.location.y + C2D.y - this.location.z;
            let c;

            for (let z = 0; z <= this.maxZ; z++)
            {
                c = FindCube(px + z, py + z, z);
                if(c != null && !Contains_NoCeiling(c.X, c.Y, c.Z))
                        C2D.cubes[C2D.cubes.length] = c;
            }

        }
    }





/**
 * CALCUL DU VECTEUR ENTRE DEUX CASES
 * Calcule le déplacement nécessaire en pixels pour aller d'une case à une autre
 * 
 * @param {Object} case_src - Case source {X, Y, Adjustment:{X,Y}}
 * @param {Object} case_dest - Case destination {X, Y, Adjustment:{X,Y}}
 * @returns {Object} Vecteur de déplacement {X, Y} en pixels
 * 
 * PRINCIPE :
 * Cette fonction calcule la différence vectorielle entre deux cases en tenant compte :
 * 1. De leurs coordonnées isométriques (partie entière)
 * 2. De leurs ajustements sous-pixel (partie décimale)
 */
    caseToCase(case_src, case_dest){
    // === CALCUL DES DIFFÉRENCES DE COORDONNÉES ===
        let cX = case_dest.x - case_src.x;  // Différence en X isométrique
        let cY = case_dest.y - case_src.y;  // Différence en Y isométrique
    
    // === CONVERSION EN DÉPLACEMENT PIXEL ===
        return {
        // Composante X : utilise la formule isométrique (cX-cY)*100 + ajustements
            x: ((cX-cY)*100) + case_dest.adjustment.x - case_src.adjustment.x,
        // Composante Y : utilise la formule isométrique (cX+cY)*50 + ajustements  
            y: ((cX+cY)*50) + case_dest.adjustment.y - case_src.adjustment.y
        };
    };
/**
 * CONVERSION CASE ISOMÉTRIQUE VERS COORDONNÉES ÉCRAN
 * Convertit des coordonnées de case isométrique en position écran en pixels
 * 
 * @param {number} Case_X - Coordonnée X de la case isométrique
 * @param {number} Case_Y - Coordonnée Y de la case isométrique  
 * @param {number} sizecube - Taille d'un cube en pixels (facteur d'échelle)
 * @returns {Object} Position écran {X, Y} en pixels
 * 
 * FORMULES ISOMÉTRIQUES FONDAMENTALES :
 * Ces formules transforment un espace 2D isométrique en coordonnées écran :
 * - screen_x = (iso_x - iso_y) * taille_cube
 * - screen_y = (iso_x + iso_y) * taille_cube / 2
 * 
 * EXPLICATION GÉOMÉTRIQUE :
 * - La différence (Case_X - Case_Y) donne la position horizontale à l'écran
 * - La somme (Case_X + Case_Y) divisée par 2 donne la position verticale
 * - Ces formules créent la perspective isométrique à 30° typique
 */
    caseToScreen(case_x, case_y, sizecube){
    // Position horizontale : différence des coordonnées * taille cube
        let pointX = parseInt((case_x - case_y) * sizecube);
    // Position verticale : somme des coordonnées * taille cube / 2
        let pointY = parseInt((case_x + case_y) * sizecube / 2);
        return {x:pointX,y:pointY};
    };

/**
 * CONVERSION COORDONNÉES MONDE 3D VERS ÉCRAN
 * Convertit une position 3D absolue du monde en coordonnées écran visibles
 * 
 * @param {number} L_X - Coordonnée X absolue dans le monde
 * @param {number} L_Y - Coordonnée Y absolue dans le monde
 * @param {number} L_Z - Coordonnée Z absolue dans le monde (altitude)
 * @param {number} sizecube - Taille d'un cube en pixels
 * @returns {Object} Position écran {X, Y} en pixels
 * 
 * PRINCIPE DE LA PROJECTION 3D ISOMÉTRIQUE :
 * 1. Soustrait la position de la caméra (Location) pour obtenir les coordonnées relatives
 * 2. Applique la correction de parallaxe pour la profondeur Z
 * 3. Convertit en coordonnées écran avec les formules isométriques
 * 4. Ajoute un décalage horizontal d'un cube pour le centrage
 * 
 * CORRECTION DE PARALLAXE :
 * La différence d'altitude (L_Z - Location.Z) affecte la position apparente :
 * - Plus un objet est haut, plus il semble décalé vers le coin supérieur-gauche
 * - Cette correction simule la perspective isométrique 3D
 */
    locationToScreen(location_x, location_y, location_z, sizecube){
    // === CALCUL DES COORDONNÉES RELATIVES À LA CAMÉRA ===
    
    /**
     * Coordonnée X relative avec correction de parallaxe :
     * - (L_X - Location.X) : position relative à la caméra
     * - (L_Z - Location.Z) : correction de la parallaxe verticale
     */
        let case_x = location_x - this.location.x - (location_z - this.location.z);
    
    /**
     * Coordonnée Y relative avec correction de parallaxe :
     * Même principe que pour X
     */
        let case_y = location_y - this.location.y - (location_z - this.location.z);
    
    // === CONVERSION EN COORDONNÉES ÉCRAN ===
    
    // Application des formules isométriques standard
        let pointX = parseInt((case_x - case_y) * sizecube);
        let pointY = parseInt((case_x + case_y) * sizecube / 2);
    
    // Décalage horizontal d'un cube pour le centrage de l'affichage
        pointX += sizecube;
        return {x:pointX, y:pointY};
    };
/**
 * GESTION DE LA CIBLE DE SOURIS AVEC LIMITATION DE PORTÉE
 * Détermine la position et la cible sous le curseur pour les actions avec portée limitée
 * Principalement utilisé pour les AOE (Area of Effect) et pouvoirs à distance
 * 
 * FONCTIONNEMENT :
 * 1. Trouve la position sous le curseur (cube ou terrain)
 * 2. Applique la limitation de portée si une entité est sélectionnée
 * 3. Recherche une cible valide à cette position
 * 4. Met à jour SelectedMouse avec les coordonnées et la cible
 * 
 * TODO: Changer X,Y,Z en Cube et supprimer Target
 */
    onSelectedMouse(){
    // === DÉTERMINATION DE LA POSITION SOUS LE CURSEUR ===
    
        let C2D = this.caseFromMouse();  // Trouve la case 3D sous le curseur
        let x = 0, y = 0, z = 0;
    
        if(C2D != null && C2D.cubes.length > 0 )
        {
        // S'il y a des cubes dans la case, prend le cube le plus haut
            let topCube = C3D.cubes[C3D.cubes.length-1];
            x = topCube.x;
            y = topCube.y;
            z = topCube.z;
        
        // Code désactivé pour les ajustements précis dans la case
        // TODO: Réimplémenter si nécessaire pour la précision sous-pixel
        /*
        if( PageInfo.MapInfo.Adjusted )
        {
            SelectedMouse.Adjustment.X = Math.floor( ((Mouse.X - PageInfo.Frame.X - C3D.Screen.X) / PageInfo.MapInfo.SizeCube)*100 );
            SelectedMouse.Adjustment.Y = Math.floor( ((Mouse.Y - PageInfo.Frame.Y - (C3D.Screen.Y + (PageInfo.MapInfo.SizeCube/2))) / PageInfo.MapInfo.SizeCube)*100 );
        }
        */
        } else {
        // Aucun cube trouvé : utilise la position du terrain à ce niveau
        x = this.location.x + this.case.x;
        y = this.location.y + this.case.y;
        z = this.location.z;
        }
    
        // === APPLICATION DE LA LIMITATION DE PORTÉE ===
    
        if( this.selected.ID != "" && this.selectedMouse.range > 0)
        {
            let entity = this.selectedEntity();  // Entité actuellement sélectionnée
            if(entity != null)
            {
                // Limite la position X dans la portée autorisée
                if(x - entity.X > this.selectedMouse.range)
                    x = entity.X + this.selectedMouse.range;
                else if(x - entity.X < -this.selectedMouse.range)
                    x = entity.X - this.selectedMouse.range;
                
                // Limite la position Y dans la portée autorisée
                if(y - entity.Y > this.selectedMouse.range)
                    y = entity.Y + this.selectedMouse.range;
                else if(y - entity.Y < -this.selectedMouse.range)
                    y = entity.Y - this.selectedMouse.range;
                
                // Limite la position Z dans la portée autorisée
                if(z - entity.Z > this.selectedMouse.range)
                    z = entity.Z + this.selectedMouse.range;
                else if(z - entity.Z < -this.selectedMouse.range)
                    z = entity.Z - this.selectedMouse.range;
            }
        }

        // === MISE À JOUR DES COORDONNÉES FINALES ===
    
        this.selectedMouse.x = x;
        this.selectedMouse.y = y;
        this.selectedMouse.z = z;

        // === RECHERCHE D'UNE CIBLE À CETTE POSITION ===
    
        if(this.map == null) return;
    
        this.selectedMouse.target = "";  // Réinitialise la cible
        let target = null;
    
        // Recherche d'abord dans les entités permanentes (bâtiments, objets fixes)
        for( let p = 0; p < this.map.permanents.length; p++)
            if( this.map.permanents[p] != null && 
                this.map.permanents[p].CanTarget && 
                this.Contains_Entity(this.map.permanents[p], this.selectedMouse.x, this.selectedMouse.y, this.selectedMouse.z) )
                target = this.map.permanents[p];
    
        // Si aucune entité permanente trouvée, recherche dans les entités mobiles
        if(target == null)
            for( let t = 0; t < this.entitys.length; t++)
                if( this.entitys[t] != null && 
                    this.entitys[t].CanTarget && 
                    this.Contains_Entity(this.entitys[t], this.selectedMouse.x, this.selectedMouse.y, this.selectedMouse.z) )
                target = this.entitys[t];
    
        if(target != null){
        // Cible trouvée par collision 3D
            this.selectedMouse.target = target.ID;
        } else {
        // === RECHERCHE PAR COLLISION 2D ÉCRAN (FALLBACK) ===
        
        // Calcule la position de la souris relative au formulaire
            let mx = Core.mouse.x - FormBase.Position.X;
            let my = Core.mouse.y - FormBase.Position.Y;
        
        // Parcourt toutes les entités dessinées pour une collision pixel
            for(let i = 0; i < this.entitysdraw.length; i++){
            // Teste si la souris est dans le rectangle de l'entité à l'écran
                if(this.entitysdraw[i].screen.x < mx && 
                   mx < this.entitysdraw[i].screen.x + this.entitysdraw[i].width && 
                   this.entitysdraw[i].screen.y < my && 
                   my < this.entitysdraw[i].screen.y + this.entitysdraw[i].height){
                    this.selectedMouse.target = this.entitysdraw[i].id;
                    break;  // Prend la première entité trouvée
                }
            }
        }
    };
/**
 * GESTION DE LA CIBLE PRINCIPALE SOUS LE CURSEUR
 * Met à jour l'objet Target avec la case, le cube et l'entité sous le curseur
 * Utilisé pour les interactions directes (clic, sélection, mouvement)
 * 
 * FONCTIONNEMENT :
 * 1. Trouve la case 3D sous le curseur
 * 2. Identifie le cube "sol" de cette case
 * 3. Recherche une entité par collision 2D à l'écran
 * 4. Met à jour les références dans l'objet Target global
 */
    onTarget(){
    // === IDENTIFICATION DE LA CASE ET DU CUBE CIBLE ===
    
        let C2D = this.findCase(Case.X, Case.Y);  // Case 3D sous le curseur
        this.target.case = C2D;                   // Stocke la référence de la case
    
        if(C2D != null) 
            this.target.cube = C2D.ToFloors();    // Trouve le cube sol de la case
        else 
            this.target.cube = null;              // Aucune case valide
    
    // === RECHERCHE D'ENTITÉ PAR COLLISION ÉCRAN ===
    
        this.target.id = "";  // Réinitialise l'ID de l'entité ciblée
    
    // Copie locale pour éviter les modifications concurrentes
        let temp_EntitysDraw = this.entitysdraw;
    
    // Position de la souris relative au formulaire
        //let mx = Mouse.X - FormBase.Position.X;
        //let my = Mouse.Y - FormBase.Position.Y;
        let mx = this.Mouse.inside.x;
        let my = this.Mouse.inside.y;
    // Parcourt toutes les entités dessinées
        for(let d = 0; d < temp_EntitysDraw.length; d++){
        // TODO: Créer une fonction pour vérifier si le personnage peut être ciblé
        // TODO: Vérifier la transparence sur le Template
        // TODO: Vérifier si le personnage est visible avec NoCeiling
        
        // Test de collision rectangle : souris dans les limites de l'entité
            if(temp_EntitysDraw[d].Screen.X < mx && 
                mx < temp_EntitysDraw[d].Screen.X + temp_EntitysDraw[d].Width && 
                temp_EntitysDraw[d].Screen.Y < my && 
                my < temp_EntitysDraw[d].Screen.Y + temp_EntitysDraw[d].Height){
                this.target.id = temp_EntitysDraw[d].id;  // Entité trouvée
                break;  // Prend la première entité trouvée (ordre Z-index)
            }
        }
    };
/**
 * DÉMARRAGE DE LA SÉLECTION MULTIPLE (GLISSER-DÉPOSER)
 * Initialise une sélection multiple quand l'utilisateur appuie sur le bouton de la souris
 * Crée un rectangle de sélection qui s'étendra jusqu'au relâchement
 */
    selectedMulti_Down(){
        selectedMulti.Active = true;           // Active le mode sélection multiple
        selected.Multi = [];                   // Vide la sélection précédente
    
        // Position initiale du rectangle de sélection (relative au formulaire)
        selectedMulti.Source.X = Mouse.X - FormBase.Position.X;
        selectedMulti.Source.Y = Mouse.Y - FormBase.Position.Y;
        selectedMulti.Destination.X = Mouse.X - FormBase.Position.X;
        selectedMulti.Destination.Y = Mouse.Y - FormBase.Position.Y;
    };
/**
 * FIN DE LA SÉLECTION MULTIPLE
 * Désactive le mode sélection multiple quand l'utilisateur relâche le bouton
 */
    selectedMulti_Up(){
        selectedMulti.Active = false;  // Désactive le mode sélection
    };

/**
 * MISE À JOUR DE LA SÉLECTION MULTIPLE PENDANT LE GLISSEMENT
 * Calcule quelles entités sont dans le rectangle de sélection pendant le mouvement
 * 
 * ALGORITHME :
 * 1. Met à jour la position de destination du rectangle
 * 2. Teste chaque entité pour voir si elle intersecte le rectangle
 * 3. Vérifie que l'entité est bien un joueur sélectionnable
 * 4. Ajoute l'entité à la liste de sélection multiple
 */
    selectedMulti_Move(){
        selected.Multi = [];  // Recalcule la sélection à chaque mouvement
    
        // Met à jour la position de destination du rectangle
        selectedMulti.Destination.X = Mouse.X - FormBase.Position.X;
        selectedMulti.Destination.Y = Mouse.Y - FormBase.Position.Y;

        // Teste chaque entité dessinée
        for (var i = 0; i < EntitysDraw.length; i++){
        // === TEST D'INTERSECTION HORIZONTALE ===
        
            if(selectedMulti.Source.X < selectedMulti.Destination.X){
            // Rectangle tiré vers la droite
            if(EntitysDraw[i].Screen.X > selectedMulti.Destination.X) continue;  // Entité trop à droite
            if(EntitysDraw[i].Screen.X + EntitysDraw[i].Width < selectedMulti.Source.X) continue;  // Entité trop à gauche
            }
            else if(selectedMulti.Source.X > selectedMulti.Destination.X){
            // Rectangle tiré vers la gauche
            if(EntitysDraw[i].Screen.X > selectedMulti.Source.X) continue;  // Entité trop à droite
            if(EntitysDraw[i].Screen.X + EntitysDraw[i].Width < selectedMulti.Destination.X) continue;  // Entité trop à gauche
            }
        
        // === TEST D'INTERSECTION VERTICALE ===
        
            if(selectedMulti.Source.Y < selectedMulti.Destination.Y){
            // Rectangle tiré vers le bas
            if(EntitysDraw[i].Screen.Y > selectedMulti.Destination.Y) continue;  // Entité trop en bas
                if(EntitysDraw[i].Screen.Y + EntitysDraw[i].Width < selectedMulti.Source.Y) continue;  // Entité trop en haut
            }
            else if(selectedMulti.Source.Y > selectedMulti.Destination.Y){
            // Rectangle tiré vers le haut
                if(EntitysDraw[i].Screen.Y > selectedMulti.Source.Y) continue;  // Entité trop en bas
                if(EntitysDraw[i].Screen.Y + EntitysDraw[i].Width < selectedMulti.Destination.Y) continue;  // Entité trop en haut
            }
        
            // === VÉRIFICATION QUE L'ENTITÉ EST UN JOUEUR SÉLECTIONNABLE ===
        
            for(var p = 0; p < PageInfo.Players.length; p++){
                if(PageInfo.Players[p] != EntitysDraw[i].ID) continue;  // N'est pas un joueur
            
            // Ajoute le joueur à la sélection multiple
                Selected.Multi[Selected.Multi.length] = EntitysDraw[i].ID;
                break;
            }
        }
    }

/**
 * RACCOURCI : Obtient l'entité actuellement sélectionnée
 * @returns {Object|null} L'objet entité sélectionnée ou null si aucune sélection
 */
    selected_Entity(){ return FindEntityID(Selected.ID); };
/**
 * RACCOURCI : Obtient l'entité actuellement ciblée
 * @returns {Object|null} L'objet entité ciblée ou null si aucune cible
 */
    selected_Target(){ return FindEntityID(Selected.Target); };

/**
 * TEST DE COLLISION 3D POINT-ENTITÉ
 * Vérifie si un point 3D se trouve à l'intérieur des limites d'une entité
 * 
 * @param {Object} entity - Entité à tester {X, Y, Z, Width, Height}
 * @param {number} pX - Coordonnée X du point à tester
 * @param {number} pY - Coordonnée Y du point à tester  
 * @param {number} pZ - Coordonnée Z du point à tester
 * @returns {boolean} true si le point est dans l'entité, false sinon
 * 
 * GÉOMÉTRIE DE L'ENTITÉ :
 * - Position : (entity.X, entity.Y, entity.Z) est le coin supérieur-droit-arrière
 * - Extension : l'entité s'étend vers les X/Y négatifs et Z positifs
 * - Volume : Width × Width × Height (entités carrées en base)
 */
    contains_Entity(entity, pX, pY, pZ){
        return (pX <= entity.X) && (pX > entity.X - entity.Width)      // Test X : dans la largeur
        && (pY <= entity.Y) && (pY > entity.Y - entity.Width)      // Test Y : dans la profondeur  
        && (pZ >= entity.Z) && (pZ < entity.Z + entity.Height);    // Test Z : dans la hauteur
    };
//function Contains_Rectangle( pX, pY, pZ, rectangle)
//{
//    return rectangle.X <= pX && pX <= rectangle.X + rectangle.Width
//        && rectangle.Y <= pY && pY <= rectangle.Y + rectangle.Height
//        && rectangle.Z <= pZ && pZ <= rectangle.Z + rectangle.Depth;
//};
/**
 * RECHERCHE D'UN CUBE DANS LA CARTE
 * Trouve un cube spécifique aux coordonnées données dans la grille 3D de la carte
 * 
 * @param {number} x - Coordonnée X dans la grille de la carte
 * @param {number} y - Coordonnée Y dans la grille de la carte
 * @param {number} z - Coordonnée Z dans la grille de la carte
 * @returns {Object|null} Le cube trouvé ou null si inexistant
 */
    findCube(x, y, z){
        if(PageInfo.Map == null) return null;               // Pas de carte chargée
        if(PageInfo.Map.Cubes.length == 0) return null;    // Grille de cubes vide
        if(!Contains_Map(x,y,z, PageInfo.Map)) return null; // Coordonnées hors limites
    
        return PageInfo.Map.Cubes[x][y][z];  // Accès direct dans la grille 3D
    };
/**
 * VÉRIFICATION DES LIMITES DE LA CARTE
 * Teste si des coordonnées 3D sont dans les limites de la carte
 * 
 * @param {number} pX - Coordonnée X à tester
 * @param {number} pY - Coordonnée Y à tester
 * @param {number} pZ - Coordonnée Z à tester
 * @param {Object} map - Objet carte avec Width, Height, Depth
 * @returns {boolean} true si dans les limites, false sinon
 */
    contains_Map(pX, pY, pZ, map){
        return 0 <= pX && pX < map.Width &&      // X dans [0, Width[
           0 <= pY && pY < map.Height &&     // Y dans [0, Height[
           0 <= pZ && pZ < map.Depth;        // Z dans [0, Depth[
    };
/**
 * RECHERCHE D'UNE CASE 3D VISIBLE
 * Trouve une case 3D dans le tableau des cases actuellement visibles à l'écran
 * 
 * @param {number} x - Coordonnée X isométrique de la case
 * @param {number} y - Coordonnée Y isométrique de la case
 * @returns {Case3D|null} La case trouvée ou null si non visible
 */
    findCase(x, y){
    // Parcours linéaire des cases visibles (optimisé par la limitation du viewport)
        for(var i = 0; i < Cases3D.length; i++)
            if ( Cases3D[i].X == x && Cases3D[i].Y == y)
                return Cases3D[i];
        return null;    
    };
/**
 * RECHERCHE D'UNE CASE À PARTIR D'UNE POSITION ABSOLUE DU MONDE
 * Convertit une position 3D absolue en coordonnées relatives à la caméra,
 * puis trouve la case 3D correspondante
 * 
 * @param {number} x - Position X absolue dans le monde
 * @param {number} y - Position Y absolue dans le monde
 * @param {number} z - Position Z absolue dans le monde
 * @returns {Case3D|null} La case trouvée ou null si non visible
 */
    findCaseLocation(x, y, z){
    // Conversion position absolue → coordonnées relatives à la caméra avec parallaxe
        x = x - Location.X - (z - Location.Z);
        y = y - Location.Y - (z - Location.Z);
    
        return FindCase(x,y);  // Recherche dans les cases visibles
    };

/**
 * RECHERCHE D'UNE ENTITÉ PAR SON IDENTIFIANT
 * Cherche une entité dans les collections d'entités permanentes et mobiles
 * 
 * @param {string} id - Identifiant unique de l'entité
 * @returns {Object|null} L'entité trouvée ou null si inexistante
 * 
 * ORDRE DE RECHERCHE :
 * 1. Entités permanentes de la carte (bâtiments, objets fixes)
 * 2. Entités mobiles (personnages, objets dynamiques)
 */
    findEntityID(id){
    // Recherche d'abord dans les entités permanentes
        if(PageInfo.Map != null)
            for( let p = 0; p < PageInfo.Map.Permanents.length; p++)
                if(PageInfo.Map.Permanents[p].ID == id)
                    return PageInfo.Map.Permanents[p];

    // Puis dans les entités mobiles
        for( let ent = 0; ent < Entitys.length; ent++)
            if( id == Entitys[ent].ID )
                return Entitys[ent];
    
        return null;  // Entité non trouvée
    };

};

export class DrawMapIso extends Draw {
    constructor(control){
        super(control);
    }
    draw(){
        const paint = this.control.Paint;
        //paint.clear();
        super.draw();

        this.drawGrid();
        this.drawLosange(this.control.case.x, this.control.case.y);
        this.drawCaseNumbers();
        //this.drawInfo();

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
    drawGrid2(){
        const paint = this.Paint;
        const control = this.control;
        const ctx = paint.context;
        const sizeCase = control.sizeCase;
        const nbrCasesFrame = control.nbrCases;

        const color = "#2bec05ff";
        const lineWidth = 2;

        for( let x = 0; x <= nbrCasesFrame; x++){
            let from = control.screenFromCase(x, 0-x);
            let to = control.screenFromCase((nbrCasesFrame*2)-x, 0-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
            
            from = control.screenFromCase(x, x);
            to = control.screenFromCase((nbrCasesFrame*2)-x, x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(x, 0-x);
            to = control.screenFromCase(x, x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);

            from = control.screenFromCase(nbrCasesFrame+x, 0-nbrCasesFrame+x);
            to = control.screenFromCase(nbrCasesFrame+x, nbrCasesFrame-x);
            paint.drawLine(from.x, from.y, to.x, to.y, color, lineWidth);
        }
        paint.borderRectangle(control.frame.x, control.frame.y, control.frame.width, control.frame.height, "black", 2);
    }
    drawCaseNumbers2(){
        const control = this.control;
        const paint = this.Paint;
        const sizeCase = control.sizeCase;
        const nbrCasesFrame = control.nbrCases;//Frame();
        const font = { family: "Arial", size: 10, style: "bold", color: "#000" };
        
        for(let x = 0; x <= nbrCasesFrame*2; x++){
            for(let y = 0; y <= nbrCasesFrame*2; y++){
                let c = control.screenFromCase(x, -y);
                if(x + y <= nbrCasesFrame*2 && x - y >= -1 && x !== nbrCasesFrame*2){
                    paint.drawText(c.x, c.y+sizeCase/2, `${x},${y}`, font);
                }
                c = control.screenFromCase(x, y);
                if(x + y <= (nbrCasesFrame*2)-1 && x - y >= 0 && y !== 0){
                    paint.drawText(c.x-5, c.y+sizeCase/2, `${x},${y}`, font);
                }
            }
        }
    }
    drawInfo(){
        const paint = this.Paint;
        const control = this.control;
        
        const font = { family: "Arial", size: 12, style: "bold", color: "#000" };
        const inside = control.Mouse.inside();
        const c = control.case;
        const nbrCasesFrame = control.nbrCases;
        const sizeCase = control.sizeCase;
        const screen = control.screenFromCase(c.x, c.y);
        const rect = control.Rectangle.rectangleBackground();
        const col = 50;//rect.x + 10;
        const line = 50;//rect.y;
        const space = 15;
        
        paint.drawText(col, line+space, `Inside: ${inside.x}, ${inside.y}`, font);
        paint.drawText(col, line+space*2, `Case: ${c.x}, ${c.y}`, font);
        paint.drawText(col, line+space*3, `Adjustment: ${c.adjustment.x}%, ${c.adjustment.y}%`, font);
        paint.drawText(col, line+space*4, `Nbr cases: ${nbrCasesFrame}`, font);
        paint.drawText(col, line+space*5, `Size case: ${sizeCase}`, font);
        paint.drawText(col, line+space*6, `Screen: ${screen.x}, ${screen.y}`, font);
    }
    drawLosange(cx, cy){
        const paint = this.Paint;
        const control = this.control;
        const ctx = paint.context;
        //const rect = control.redress();
        const rect = control.Rectangle.rectangleBackground();
        const width = control.form.Size.width;
        const height = control.form.Size.height;
        const left = rect.x;
        const top = rect.y;
        
        ctx.fillStyle = "#ff0000";
        for(let x = 0; x < width; x++){
            for(let y = 0; y < height; y++){
                const c = control.caseFromScreen(x, y);
                if(c.x === cx && c.y === cy){
                    // Dessiner un pixel (fillRect 1x1)
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
}

export class MouseIso extends Mouse{
     constructor(control){
        super(control);
    }
     hover(){
        super.hover();
        const control = this.control;
        if(Core.mousehover.control !== control)return;
        control.case = control.caseFromMouse();
    }
    wheel(deltaX, deltaY){
        const control = this.control;
        control.nbrCases = deltaY < 0 ? control.nbrCases -= 1 : control.nbrCases += 1;
    }
}

export class ResizeIso extends Resize{
    constructor(control){
        super(control);    
    }   
    to(width, height=width){
        const control = this.control;
        height = (width - control.Border.left - control.Border.right)/2;
        height += control.Border.top + control.Border.bottom;
        super.to(width, height);
        this.control.modified();
    }
}

export class ScaleIso extends Scale{
    constructor(control){
        super(control);    
    }
    to(ratio_width, ratio_height){
        //super.to(ratio_width, ratio_width/2);
        //this.control.modified();
    }
}

export class FactoryMapIso extends Factory {  
    createControl(){ return new MapIso(); }
    createDraw(control){ return new DrawMapIso(control); }
    createMouse(control){ return new MouseIso(control); }
    createResize(control){ return new ResizeIso(control); }
    createScale(control){ return new ScaleIso(control); }
}
