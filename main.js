import "normalize.css";
import "./style.css";
import * as THREE from "three";
import debounce from "lodash.debounce";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";

import AdditiveShader from "./shaders/Additive";
import VolumetricLightScattering from "./shaders/VolumetricLightScattering";
import VolumetricLightCylinder from "./shaders/VolumetricLightCylinder";

// render layers
const DEFAULT_LAYER = 0;
const OCCLUSION_LAYER = 1;

// create scene / cameras
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	20,
	window.innerWidth / window.innerHeight,
	0.1,
	20
);
camera.position.z = 10;

const occlusionCamera = camera.clone();
occlusionCamera.layers.set(OCCLUSION_LAYER);

// add point lights
const backLight = new THREE.PointLight(0x00aaff, 3, 10);
backLight.layers.enable(OCCLUSION_LAYER);
backLight.position.set(-5, 5, -5);
scene.add(backLight);

const fillLight = new THREE.PointLight(0x00aaff, 0.7, 10);
fillLight.layers.enable(OCCLUSION_LAYER);
fillLight.position.set(-5, 0, 5);
scene.add(fillLight);

const keyLight = new THREE.PointLight(0xff00ff, 2, 10);
keyLight.layers.enable(OCCLUSION_LAYER);
keyLight.position.set(5, 0, 0);
scene.add(keyLight);

// create renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector("#app").appendChild(renderer.domElement);

const loader = new GLTFLoader();

const modelContainer = new THREE.Group();
modelContainer.layers.enable(OCCLUSION_LAYER);
scene.add(modelContainer);

loader.load(
	"./model/cybertruck.glb",
	(gltf) => {
		// add default mesh
		modelContainer.add(gltf.scene);

		// add black mesh set to occlusion layer
		const occlusionScene = gltf.scene.clone();
		const blackMaterial = new THREE.MeshBasicMaterial({
			color: new THREE.Color(0x000000),
		});
		occlusionScene.traverse((node) => {
			if (node.material) {
				node.material = blackMaterial;
			}
			if (node.layers) {
				node.layers.set(OCCLUSION_LAYER);
			}
		});
		modelContainer.add(occlusionScene);
	},
	undefined,
	console.error
);

// volumetric lighting
const occlusionRenderTarget = new THREE.WebGLRenderTarget(
	window.innerWidth * 0.5,
	window.innerHeight * 0.5
);

const occlusionComposer = new EffectComposer(renderer, occlusionRenderTarget);
occlusionComposer.renderToScreen = false;
occlusionComposer.addPass(new RenderPass(scene, occlusionCamera));

const lightScatteringPass = new ShaderPass(VolumetricLightScattering());
lightScatteringPass.needsSwap = false;
occlusionComposer.addPass(lightScatteringPass);

const lightGeometry = new THREE.CylinderGeometry(3, 6, 15, 32, 6, true);
lightGeometry.applyMatrix4(
	new THREE.Matrix4().makeTranslation(
		0,
		-lightGeometry.parameters.height / 2,
		0
	)
);
lightGeometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

const lightCylinderMaterial = new THREE.ShaderMaterial(
	VolumetricLightCylinder()
);
const lightConeTarget = new THREE.Vector3(0, 0, -8);
const lightCone = new THREE.Mesh(lightGeometry, lightCylinderMaterial);
lightCone.position.set(-5, 5, -8);
lightCone.layers.set(OCCLUSION_LAYER);
lightCylinderMaterial.uniforms.spotPosition.value = lightCone.position;
scene.add(lightCone);

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(new RenderPass(scene, camera));

const additivePass = new ShaderPass(AdditiveShader());
additivePass.uniforms.tAdd.value = occlusionRenderTarget.texture;
additivePass.needsSwap = false;
finalComposer.addPass(additivePass);

// mouse move
function mousemove(e) {
	lightCone.position.x = 5 * ((e.clientX / window.innerWidth) * 2 - 1);
	backLight.position.x = lightCone.position.x;
}
window.addEventListener("mousemove", mousemove);

// handle window resize
function resizeRenderer() {
	occlusionComposer.setSize(window.innerWidth * 0.5, window.innerHeight * 0.5);
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	occlusionCamera.aspect = camera.aspect;
	occlusionCamera.updateProjectionMatrix();
}
window.addEventListener("resize", debounce(resizeRenderer, 50));

// render scene
const clock = new THREE.Clock();
async function render() {
	const delta = clock.getDelta();

	modelContainer.rotation.x += delta * 0.5;
	modelContainer.rotation.y += delta * 0.5;

	lightCone.lookAt(lightConeTarget);
	lightCylinderMaterial.uniforms.spotPosition.value = lightCone.position;
	const lightConePosition = lightCone.position.clone();
	const vector = lightConePosition.project(occlusionCamera);
	lightScatteringPass.uniforms.lightPosition.value.set(
		(vector.x + 1) / 2,
		(vector.y + 1) / 2
	);

	renderer.setRenderTarget(occlusionRenderTarget);
	occlusionComposer.render();

	renderer.setRenderTarget(null);
	finalComposer.render();

	requestAnimationFrame(render);
}

render();
