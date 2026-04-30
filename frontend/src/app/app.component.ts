import { Component, OnInit, ElementRef, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, Chart, registerables } from 'chart.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LoginComponent } from './auth/login.component';
import { BetTabComponent } from './bet/bet-tab.component';

Chart.register(...registerables);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, NgChartsModule, LoginComponent, BetTabComponent],
  template: `
    <div class="main-container">
      
      <header>
        <div class="brand">
          <h1>🏎️ F1 Fantasy <span class="season-badge">2026</span></h1>
        </div>
        <div *ngIf="userId" class="user-profile">
          <div class="avatar">{{username.charAt(0).toUpperCase()}}</div>
          <div class="user-details">
            <span class="name">{{username}}</span>
            <span class="points">🏆 {{myPoints}} pts</span>
          </div>
          <button (click)="logout()" class="btn-logout" title="Sair">⏻</button>
        </div>
      </header>

      <app-login *ngIf="!userId" (authenticated)="setSess($event)"></app-login>

      <div *ngIf="userId" class="dashboard animate-up">
        
        <nav class="nav-tabs">
          <button [class.active]="activeTab === 'bet'" (click)="switchTab('bet')">🎲 Grid & Apostas</button>
          <button [class.active]="activeTab === 'analysis'" (click)="switchTab('analysis')">📊 Telemetria</button>
          <button [class.active]="activeTab === 'team'" (click)="switchTab('team')">🏢 Hub da Equipe</button>
          <button [class.active]="activeTab === 'windtunnel'" (click)="switchTab('windtunnel')">💨 Túnel de Vento</button>
        </nav>

        <app-bet-tab
          *ngIf="activeTab === 'bet'"
          [drivers]="drivers"
          [ranking]="ranking"
          [calendar]="calendar"
          [userId]="userId"
          [username]="username">
        </app-bet-tab>

        <div *ngIf="activeTab === 'analysis'" class="tab-content">
          <div class="panel ai-panel">
            <div class="panel-header"><h3>🧠 Engenharia de Dados & IA</h3></div>
            
            <div class="driver-analysis-header" *ngIf="getSelectedDriverObj() as drv">
               <div class="drv-img-box"><img [src]="drv.image" class="big-avatar" (error)="handleImageError($event)"></div>
               <div class="drv-info-box"><h2>{{drv.name}} <span class="drv-num">#{{drv.number}}</span></h2><p class="drv-team">{{drv.team}}</p></div>
               <div class="car-img-box"><img [src]="drv.car" class="car-img"></div>
            </div>

            <div class="ai-controls">
              <div class="control-group"><label>Piloto</label><select [(ngModel)]="analysisDriver" class="premium-select"><option *ngFor="let d of drivers" [value]="d.code">{{d.name}}</option></select></div>
              <div class="control-group"><label>GP A (ou Histórico)</label><select [(ngModel)]="raceX" class="premium-select"><option value="SEASON">📅 Histórico 2025</option><option disabled>--- Corridas ---</option><option *ngFor="let r of racesList" [value]="r">{{r}}</option></select></div>
              <div class="vs-badge">VS</div>
              <div class="control-group"><label>GP B</label><select [(ngModel)]="raceY" class="premium-select" [disabled]="raceX === 'SEASON'" [style.opacity]="raceX === 'SEASON' ? 0.5 : 1"><option *ngFor="let r of racesList" [value]="r">{{r}}</option></select></div>
              <button (click)="analyze()" class="btn-ai" [disabled]="isAnalyzing">{{ isAnalyzing ? 'Processando...' : 'GERAR RELATÓRIO' }}</button>
            </div>
            
            <div *ngIf="chartData" class="chart-wrapper"><canvas baseChart [data]="chartData" [options]="chartOptions" [type]="'line'"></canvas></div>
            <div *ngIf="analysisResult" class="ai-output fade-in"><div class="ai-header">🏁 Relatório do Engenheiro</div><div class="ai-body">{{analysisResult}}</div></div>
          </div>
        </div>

        <div *ngIf="activeTab === 'team'" class="tab-content">
            <div class="panel hologram-panel">
                <div class="panel-header header-flex">
                    <h3>💎 Garagem Virtual</h3>
                    <div class="car-selector"><select [(ngModel)]="selectedCarFile" (change)="changeCarModel()" class="premium-select small"><option *ngFor="let car of teamCars" [value]="car.file">{{ car.name }}</option></select></div>
                </div>
                <div class="hologram-container" (wheel)="onScroll($event)">
                    <canvas #hologramCanvas id="hologramCanvas" (mousemove)="onMouseMove($event)"></canvas>
                    <div class="mouse-tooltip" [style.top.px]="tooltipPos.y" [style.left.px]="tooltipPos.x" [class.visible]="selectedPartName">
                        <h5>{{ selectedPartName }}</h5>
                        <div class="tooltip-row"><span>MAT:</span> <strong>{{ partStats.material }}</strong></div>
                    </div>
                    <div class="controls-hint">🖱️ Scroll: Zoom | Clique e arraste: Girar</div>
                </div>
            </div>
        </div>

        <div *ngIf="activeTab === 'windtunnel'" class="tab-content">
            <div class="panel wind-panel">
                <div class="panel-header"><h3>💨 Simulador Aerodinâmico (CFD)</h3></div>
                <div class="hologram-container">
                    <canvas #windCanvas id="windCanvas"></canvas>
                    <div class="aero-hud">
                        <div class="hud-row"><span>VELOCIDADE</span> <div class="bar"><div class="fill" style="width: 90%"></div></div> <strong>320 km/h</strong></div>
                        <div class="hud-row"><span>DOWNFORCE</span> <div class="bar"><div class="fill good" style="width: 85%"></div></div> <strong>Alta</strong></div>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100vw; min-height: 100vh; background: #0f1014; --bg-dark: #0f1014; --panel-bg: #1e1f26; --accent: #e10600; --text: #fff; --muted: #8a8a93; --border: #2d2e36; --soft: #ff3333; --med: #ffcc00; --hard: #f0f0f0; }
    .main-container { font-family: 'Segoe UI', Roboto, sans-serif; background: var(--bg-dark); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; overflow-x: hidden; }
    
    header { background: var(--panel-bg); border-bottom: 3px solid var(--accent); height: 70px; display: flex; align-items: center; justify-content: space-between; padding: 0 25px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
    .brand h1 { font-style: italic; margin: 0; font-size: 1.6rem; } .season-badge { background: var(--accent); padding: 2px 8px; border-radius: 4px; font-size: 0.9rem; }
    .nav-tabs { display: flex; gap: 5px; padding: 25px 25px 0; max-width: 1600px; margin: 0 auto; width: 100%; }
    .nav-tabs button { background: var(--panel-bg); color: var(--muted); border: none; padding: 14px 25px; cursor: pointer; border-radius: 8px 8px 0 0; font-weight: 600; font-size: 1rem; transition: 0.2s; }
    .nav-tabs button.active { background: var(--accent); color: white; transform: translateY(-2px); }

    .panel { background: var(--panel-bg); border-radius: 12px; border: 1px solid var(--border); margin-bottom: 25px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .panel-header { padding: 18px 25px; background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .hologram-panel, .wind-panel { height: 600px; position: relative; margin: 25px; border: 1px solid var(--accent); }
    .hologram-container { width: 100%; height: 100%; position: relative; background: radial-gradient(circle at center, #1a1b25 0%, #000 100%); overflow: hidden; cursor: crosshair; }
    canvas { width: 100%; height: 100%; display: block; }

    .mouse-tooltip { position: fixed; background: rgba(10, 10, 15, 0.95); border: 1px solid #00ffff; box-shadow: 0 0 15px rgba(0, 255, 255, 0.2); padding: 15px; border-radius: 4px; pointer-events: none; z-index: 9999; min-width: 180px; opacity: 0; transition: opacity 0.1s; transform: translate(20px, 20px); backdrop-filter: blur(5px); }
    .mouse-tooltip.visible { opacity: 1; }
    .mouse-tooltip h5 { margin: 0 0 8px 0; color: #00ffff; font-family: 'Courier New', monospace; border-bottom: 1px solid #333; padding-bottom: 5px; text-transform: uppercase; }
    .tooltip-row { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 3px; color: #ccc; }
    .tooltip-row strong { color: #fff; }
    .controls-hint { position: absolute; bottom: 10px; width: 100%; text-align: center; color: #666; font-size: 0.8rem; pointer-events: none; text-transform: uppercase; letter-spacing: 1px; }
    .aero-hud { position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,0.7); padding: 20px; border-radius: 8px; border-left: 4px solid #00ffff; pointer-events: none; }
    .hud-row { display: flex; align-items: center; gap: 15px; margin-bottom: 10px; color: #fff; font-family: 'Courier New'; font-size: 0.9rem; }
    .bar { width: 150px; height: 6px; background: #333; border-radius: 4px; overflow: hidden; }
    .fill { height: 100%; background: #00ffff; box-shadow: 0 0 10px #00ffff; }
    .fill.good { background: #00ff00; box-shadow: 0 0 10px #00ff00; }

    .premium-select { background-color: #15161b; color: #fff; border: 1px solid #333; border-radius: 6px; padding: 12px 15px; width: 100%; cursor: pointer; }
    .premium-select.small { padding: 8px; font-size: 0.9rem; }

    .driver-analysis-header { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(90deg, #15161b 0%, #1e1f26 100%); padding: 30px; margin: 25px; border-radius: 12px; border: 1px solid var(--border); position: relative; overflow: hidden; }
    .driver-analysis-header::after { content: ''; position: absolute; top:0; left:0; width: 5px; height: 100%; background: var(--accent); }
    .big-avatar { height: 110px; width: 110px; object-fit: cover; border-radius: 50%; border: 3px solid var(--accent); background: #333; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
    .drv-info-box { flex: 1; padding: 0 30px; }
    .drv-info-box h2 { margin: 0; font-size: 2.2rem; font-style: italic; letter-spacing: -1px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
    .drv-num { color: var(--accent); font-size: 1.5rem; margin-left: 10px; }
    .drv-team { color: var(--muted); font-size: 1.1rem; margin: 5px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .car-img { height: 90px; object-fit: contain; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.5)); }

    .ai-controls { padding: 25px; display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap; background: #15161b; border-bottom: 1px solid var(--border); }
    .control-group { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 150px; }
    .control-group label { font-size: 0.75rem; color: var(--muted); font-weight: 800; text-transform: uppercase; }
    .btn-ai { background: white; color: black; border: none; padding: 0 30px; border-radius: 6px; font-weight: 800; cursor: pointer; height: 42px; text-transform: uppercase; }
    .chart-wrapper { background: white; padding: 20px; margin: 25px; border-radius: 12px; height: 400px; }
    .ai-output { margin: 25px; background: #15161b; border-radius: 12px; border: 1px solid var(--border); overflow: hidden; }
    .ai-header { background: var(--accent); color: white; padding: 10px 25px; font-weight: bold; font-size: 0.9rem; text-transform: uppercase; }
    .ai-body { padding: 25px; color: #ccc; line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap; }
    .user-profile { display: flex; gap: 10px; align-items: center; } .avatar { width: 35px; height: 35px; background: var(--accent); border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; } .btn-logout { background: transparent; border: 1px solid #444; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  apiUrl = 'http://localhost:8000';
  activeTab = 'bet';
  userId: number | null = null; username = '';
  myPoints = 0;
  drivers: any[] = []; ranking: any[] = [];
  
  calendar = [
    { date: '06-08 MAR', gp: 'GP da Austrália', sprint: false },
    { date: '20-22 MAR', gp: 'GP da China', sprint: true },
    { date: '03-05 ABR', gp: 'GP do Japão', sprint: false },
    { date: '17-19 ABR', gp: 'GP do Bahrein', sprint: false },
    { date: '01-03 MAI', gp: 'GP de Miami', sprint: true },
    { date: '15-17 MAI', gp: 'GP da Emilia Romagna', sprint: false },
    { date: '29-31 MAI', gp: 'GP de Mônaco', sprint: false },
    { date: '12-14 JUN', gp: 'GP do Canadá', sprint: false }
  ];
  racesList = this.calendar.map(c => c.gp.replace('GP do ', '').replace('GP da ', '').replace('GP de ', ''));

  analysisDriver = 'VER'; raceX = 'SEASON'; raceY = 'Saudi Arabia';
  analysisResult = ''; isAnalyzing = false;
  chartData: ChartConfiguration<'line'>['data'] | null = null;
  chartOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false };

  @ViewChild('hologramCanvas') hologramCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('windCanvas') windCanvas!: ElementRef<HTMLCanvasElement>;
  
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private carModel!: THREE.Group;
  private frameId: number | null = null;
  
  teamCars = [
    { name: 'Protótipo Genérico', file: 'FiaModel.glb' },
    { name: 'Scuderia Ferrari', file: 'Ferrari.glb' },
    { name: 'Red Bull Racing', file: 'RedBull.glb' },
    { name: 'Visa Cash App RB', file: 'RacingBull.glb' },
    { name: 'Alpine F1', file: 'Alpine.glb' },
    { name: 'Aston Martin', file: 'AstonMartin.glb' },
    { name: 'Mercedes-AMG', file: 'Mercedes.glb' },
    { name: 'Cadillac Racing', file: 'Cadillac.glb' },
    { name: 'Audi Sport', file: 'Audi.glb' }
  ];
  selectedCarFile = 'FiaModel.glb';

  cameraDistance = 5;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  tooltipPos = { x: 0, y: 0 };
  selectedPartName: string = '';
  partStats = { material: '--', weight: '--' };
  private highlightedMesh: THREE.Mesh | null = null;
  private originalMaterial: any = null;
  
  // VARIAVEIS CFD (Túnel de Vento)
  private flowLines: THREE.Line[] = [];
  private carWheels: THREE.Object3D[] = [];

  constructor(private http: HttpClient) {}
  ngOnInit() { this.checkSession(); }

  switchTab(tab: string) {
    this.activeTab = tab;
    this.cleanup3D(); 
    if (tab === 'team') setTimeout(() => this.initHologram(), 50);
    if (tab === 'windtunnel') setTimeout(() => this.initWindTunnel(), 50);
  }

  cleanup3D() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    if (this.renderer) { this.renderer.dispose(); }
    this.scene = null as any; this.camera = null as any;
    this.flowLines = [];
    this.carWheels = [];
  }

  // --- 1. HOLOGRAMA (HUB) ---
  initHologram() {
    if (!this.hologramCanvas) return;
    const canvas = this.hologramCanvas.nativeElement;
    this.setupScene(canvas);
    this.camera.position.set(5, 3, 5);
    this.camera.lookAt(0, 0, 0);
    this.loadCarModel(this.selectedCarFile);
    this.animateHologram();
  }

  changeCarModel() {
    if (this.scene) {
        this.scene.children = this.scene.children.filter(obj => obj.type !== 'Group'); 
        this.loadCarModel(this.selectedCarFile);
    }
  }

  loadCarModel(fileName: string) {
    const loader = new GLTFLoader();
    loader.load(`assets/3d/${fileName}`, (gltf: any) => {
        this.carModel = gltf.scene;
        // Normalização
        const box = new THREE.Box3().setFromObject(this.carModel);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 5 / maxDim;
        this.carModel.scale.setScalar(scale);
        this.carModel.position.sub(center.multiplyScalar(scale));
        this.carModel.position.y = -0.5;
        this.carModel.traverse((child: any) => { if (child.isMesh) child.geometry.computeBoundingBox(); });
        this.scene.add(this.carModel);
    });
  }

  onScroll(event: WheelEvent) {
    event.preventDefault();
    const speed = 0.5;
    if (event.deltaY > 0) this.cameraDistance += speed; else this.cameraDistance -= speed;
    if (this.cameraDistance < 3) this.cameraDistance = 3;
    if (this.cameraDistance > 12) this.cameraDistance = 12;
    if (this.camera) {
        this.camera.position.set(this.cameraDistance, this.cameraDistance * 0.6, this.cameraDistance);
        this.camera.lookAt(0, 0, 0);
    }
  }

  onMouseMove(event: MouseEvent) {
    if (this.activeTab !== 'team' || !this.carModel) return;
    this.tooltipPos = { x: event.clientX + 15, y: event.clientY + 15 };
    const canvas = this.hologramCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.carModel.children, true);

    if (this.highlightedMesh && this.originalMaterial) {
        this.highlightedMesh.material = this.originalMaterial;
        this.highlightedMesh = null;
        this.originalMaterial = null;
    }

    if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        this.highlightedMesh = hit;
        this.originalMaterial = hit.material;
        hit.material = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.8 });
        
        const name = hit.name.toLowerCase();
        if (name.includes('wheel') || name.includes('tire')) this.updateInfo('Pneu (Soft C5)', 'Borracha', '12kg');
        else if (name.includes('wing') || name.includes('spoiler')) this.updateInfo('Asa Aerodinâmica', 'Fibra de Carbono', '8kg');
        else if (name.includes('halo')) this.updateInfo('Halo', 'Titânio', '7kg');
        else if (name.includes('suspension')) this.updateInfo('Suspensão', 'Carbono', '4kg');
        else this.updateInfo('Chassi / Carenagem', 'Compósito', 'Variable');
    } else {
        this.selectedPartName = '';
    }
  }

  updateInfo(name: string, mat: string, w: string) {
    this.selectedPartName = name;
    this.partStats = { material: mat, weight: w };
  }

  animateHologram() {
    this.frameId = requestAnimationFrame(() => this.animateHologram());
    if (this.carModel && !this.selectedPartName) this.carModel.rotation.y += 0.003; 
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }

  // --- 2. TÚNEL DE VENTO (CFD REALISTA) ---
  initWindTunnel() {
    if (!this.windCanvas) return;
    const canvas = this.windCanvas.nativeElement;
    this.setupScene(canvas);
    
    // Câmera Perfil Estrito
    this.camera.position.set(10, 0, 0); 
    this.camera.lookAt(0, 0, 0);

    const loader = new GLTFLoader();
    loader.load(`assets/3d/${this.selectedCarFile}`, (gltf: any) => {
        const car = gltf.scene;
        const box = new THREE.Box3().setFromObject(car);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 5 / maxDim;
        car.scale.setScalar(scale);
        car.position.sub(center.multiplyScalar(scale));
        
        // Se o carro estiver de frente, vira de lado
        car.rotation.y = 0; 

        // Encontrar Rodas
        this.carWheels = [];
        car.traverse((child: any) => {
            const n = child.name.toLowerCase();
            if (child.isMesh && (n.includes('wheel') || n.includes('tire') || n.includes('rim'))) {
                this.carWheels.push(child);
            }
        });
        
        this.scene.add(car);
    });

    // --- GERAR LINHAS DE FLUXO (STREAMLINES) ---
    // Simula o ar desviando do carro (Curvas Matemáticas)
    const lineCount = 40;
    const material = new THREE.LineBasicMaterial({ vertexColors: true });

    for (let i = 0; i < lineCount; i++) {
        const points = [];
        const colors = [];
        // Altura aleatória (Y) e Profundidade (X - na visão da câmera é profundidade)
        const yStart = (Math.random() - 0.5) * 3; 
        const xOffset = (Math.random() - 0.5) * 1; 

        // O Vento corre no eixo Z (de 10 a -10)
        for (let z = 10; z > -10; z -= 0.5) {
            // FÓRMULA DE DESVIO: Se chegar perto do centro (Z=0), sobe em Y (pula o carro)
            const proximity = Math.exp(-Math.pow(z, 2) / 4); // Curva de sino
            const y = yStart + (proximity * 1.2); // Sobe 1.2 unidades no centro
            
            points.push(new THREE.Vector3(xOffset, y, z));

            // COR: Azul longe, Vermelho/Amarelo perto (Pressão)
            const color = new THREE.Color();
            if (proximity > 0.5) color.setHSL(0.0, 1.0, 0.5); // Vermelho (Colisão)
            else if (proximity > 0.2) color.setHSL(0.15, 1.0, 0.5); // Amarelo
            else color.setHSL(0.6, 1.0, 0.5); // Azul (Laminar)
            colors.push(color.r, color.g, color.b);
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const line = new THREE.Line(geometry, material);
        this.flowLines.push(line);
        this.scene.add(line);
    }

    this.animateWind();
  }

  animateWind() {
    this.frameId = requestAnimationFrame(() => this.animateWind());

    // 1. Girar Rodas
    this.carWheels.forEach(w => w.rotation.x -= 0.2);

    // 2. Animar Linhas (Efeito de deslocamento)
    this.flowLines.forEach((line, idx) => {
        // Move a linha inteira um pouco para trás e reseta para dar sensação de fluxo
        line.position.z -= 0.2; 
        if (line.position.z < -5) line.position.z = 5;
    });

    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }

  setupScene(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = null; 
    const aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dl = new THREE.DirectionalLight(0xffffff, 1.5);
    dl.position.set(5, 10, 7.5);
    this.scene.add(dl);
  }

  ngOnDestroy() { this.cleanup3D(); }
  getSelectedDriverObj() { return this.drivers.find(d => d.code === this.analysisDriver); }
  handleImageError(event: any) { event.target.src = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png'; }

  // TELEMETRIA COM FALLBACK
  analyze() {
    this.isAnalyzing = true; 
    this.chartData = null; 
    this.analysisResult = 'Conectando aos servidores de engenharia...';
    
    const payload = { driver_code: this.analysisDriver, race_x: this.raceX, race_y: this.raceY };
    
    this.http.post<any>(`${this.apiUrl}/analyze`, payload).subscribe({
        next: (res) => {
          this.analysisResult = res.analysis; 
          this.isAnalyzing = false;
          this.setupChart(res);
        },
        error: () => { 
            // FALLBACK SE A API FALHAR
            this.analysisResult = '⚠️ Conexão instável com o Pit Wall. Exibindo dados em cache offline.'; 
            this.isAnalyzing = false;
            // Dados Mockados para não deixar a tela vazia
            this.setupChart({
                mode: 'season', 
                chart_data: { labels: ['BHR','SAU','AUS'], data: [1, 2, 1] } 
            });
        }
      });
  }

  setupChart(res: any) {
      if (res.mode === 'season') {
         this.chartOptions = { responsive: true, maintainAspectRatio: false, scales: { y: { reverse: true, min: 1, max: 20, title: { display: true, text: 'Posição Final' } } } };
         this.chartData = { labels: res.chart_data.labels, datasets: [{ label: `Performance 2025 - ${this.analysisDriver}`, data: res.chart_data.data, borderColor: '#e10600', backgroundColor: 'rgba(225,6,0,0.1)', tension: 0.1, fill: true }] };
      } else {
         const rx = res.chart_data.race_x; const ry = res.chart_data.race_y;
         this.chartOptions = { responsive: true, maintainAspectRatio: false, scales: { y: { reverse: true, title: { display: true, text: 'Tempo (s)' } } } };
         this.chartData = { labels: rx.laps, datasets: [{ label: rx.name, data: rx.times, borderColor: '#e10600', tension:0.3 }, { label: ry.name, data: ry.times, borderColor: '#0090ff', tension:0.3 }] };
      }
  }

  setSess(r:any) { this.userId=r.user_id; this.username=r.username; localStorage.setItem('f1_user', JSON.stringify(r)); this.initApp(); }
  checkSession() { const s=localStorage.getItem('f1_user'); if(s) this.setSess(JSON.parse(s)); }
  logout() { this.userId=null; localStorage.clear(); }
  initApp() { this.http.get<any[]>(`${this.apiUrl}/drivers`).subscribe(d => this.drivers = d); this.http.get<any[]>(`${this.apiUrl}/ranking`).subscribe(r => this.ranking = r); }
}