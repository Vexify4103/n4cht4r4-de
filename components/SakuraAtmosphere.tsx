"use client";

import { useEffect, useRef } from "react";

type Petal = {
	x: number;
	y: number;
	size: number;
	speed: number;
	drift: number;
	rotation: number;
	spin: number;
	phase: number;
};

export function SakuraAtmosphere() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const context = canvas.getContext("2d");
		if (!context) return;

		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		let animationFrame = 0;
		let width = 0;
		let height = 0;
		let petals: Petal[] = [];

		function resize() {
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			width = window.innerWidth;
			height = window.innerHeight;
			canvas!.width = Math.floor(width * ratio);
			canvas!.height = Math.floor(height * ratio);
			canvas!.style.width = `${width}px`;
			canvas!.style.height = `${height}px`;
			context!.setTransform(ratio, 0, 0, ratio, 0, 0);
			const count = Math.max(12, Math.min(34, Math.floor(width / 55)));
			petals = Array.from({ length: count }, (_, index) => ({
				x: Math.random() * width,
				y: Math.random() * height,
				size: 3 + Math.random() * 5,
				speed: 0.18 + Math.random() * 0.38,
				drift: 0.18 + Math.random() * 0.42,
				rotation: Math.random() * Math.PI,
				spin: (Math.random() - 0.5) * 0.012,
				phase: index * 0.7 + Math.random() * 4,
			}));
		}

		function drawPetal(petal: Petal, time: number) {
			const sway = Math.sin(time * 0.00055 + petal.phase) * 9;
			context!.save();
			context!.translate(petal.x + sway, petal.y);
			context!.rotate(petal.rotation);
			context!.scale(1, 0.68);
			context!.beginPath();
			context!.moveTo(0, -petal.size);
			context!.bezierCurveTo(petal.size, -petal.size * 0.55, petal.size, petal.size * 0.55, 0, petal.size);
			context!.bezierCurveTo(-petal.size, petal.size * 0.55, -petal.size, -petal.size * 0.55, 0, -petal.size);
			context!.fillStyle = "rgba(255, 183, 211, 0.56)";
			context!.fill();
			context!.restore();
		}

		function draw(time: number) {
			context!.clearRect(0, 0, width, height);
			for (const petal of petals) {
				drawPetal(petal, time);
				if (!reduceMotion) {
					petal.y += petal.speed;
					petal.x += petal.drift;
					petal.rotation += petal.spin;
					if (petal.y > height + 16 || petal.x > width + 20) {
						petal.y = -16;
						petal.x = Math.random() * width * 0.78;
					}
				}
			}
			if (!reduceMotion) animationFrame = window.requestAnimationFrame(draw);
		}

		resize();
		draw(0);
		window.addEventListener("resize", resize);
		return () => {
			window.removeEventListener("resize", resize);
			window.cancelAnimationFrame(animationFrame);
		};
	}, []);

	return <canvas ref={canvasRef} className="sakura-atmosphere" aria-hidden="true" />;
}
