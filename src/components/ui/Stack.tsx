"use client";

import { useEffect, useRef } from "react";
import Matter from "matter-js";

const STACK = [
    {
        label: "# コードジェンガ",
        pulled: false,
    },
    {
        label:
            "AI が書いたコードを1行ずつ削除し合う、スリル満点のコーディングゲーム。",
        pulled: false,
    },
    {
        label: "const result = calculateScore(items);",
        pulled: false,
    },
    {
        label: "items.forEach((item) => process(item));",
        pulled: false,
    },
    {
        label: "return result > 0 ? 'success' : 'retry';",
        pulled: true,
    },
];

const FONT_FAMILY =
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

export function Stack() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;

        if (!container) return;

        const width = container.clientWidth;
        const height = 380;

        // =========================
        // Canvas
        // =========================

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        canvas.style.width = "100%";
        canvas.style.height = `${height}px`;

        container.appendChild(canvas);

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            return;
        }

        // =========================
        // フォントサイズ
        // =========================

        // 全体的に以前の約2倍
        const fontSize = 15;

        ctx.font = `${fontSize}px ${FONT_FAMILY}`;

        // =========================
        // ブロック幅をlabelから計算
        // =========================

        const horizontalPadding = 64;
        const lineNumberWidth = 42;

        const blockWidths = STACK.map((block) => {
            ctx.font = `${fontSize}px ${FONT_FAMILY}`;

            const textWidth = ctx.measureText(
                block.label,
            ).width;

            return textWidth +
                horizontalPadding +
                lineNumberWidth;
        });

        // 画面に収まる最大幅
        const maxBlockWidth = Math.max(
            width - 24,
            240,
        );

        const blocks = blockWidths.map((blockWidth) =>
            Math.min(blockWidth, maxBlockWidth),
        );

        // =========================
        // Matter.js
        // =========================

        const engine = Matter.Engine.create({
            gravity: {
                x: 0,
                y: 1,
                scale: 0.001,
            },
        });

        const world = engine.world;

        // =========================
        // 積み木の高さ
        // =========================

        const blockHeight = 64;
        const blockGap = 4;

        // =========================
        // 積み木生成
        // =========================

        const bodies = STACK.map(
            (block, index) => {
                const blockWidth = blocks[index];

                const body = Matter.Bodies.rectangle(
                    width / 2,
                    height -
                    55 -
                    index * (blockHeight + blockGap),
                    blockWidth,
                    blockHeight,
                    {
                        restitution: 0.1,
                        friction: 0.8,
                        frictionStatic: 0.8,
                        frictionAir: 0.02,
                        density: 0.002,

                        chamfer: {
                            radius: 6,
                        },

                        render: {
                            fillStyle:
                                index % 2 === 0
                                    ? "#d97706"
                                    : "#b45309",

                            strokeStyle: block.pulled
                                ? "#ef4444"
                                : "#92400e",

                            lineWidth: block.pulled
                                ? 4
                                : 2,
                        },
                    },
                );

                Matter.Composite.add(
                    world,
                    body,
                );

                return {
                    body,
                    label: block.label,
                    index,
                    width: blockWidth,
                };
            },
        );

        // =========================
        // 床
        // =========================

        const ground = Matter.Bodies.rectangle(
            width / 2,
            height + 15,
            width,
            30,
            {
                isStatic: true,

                render: {
                    visible: false,
                },
            },
        );

        // =========================
        // 壁
        // =========================

        const leftWall = Matter.Bodies.rectangle(
            -15,
            height / 2,
            30,
            height,
            {
                isStatic: true,

                render: {
                    visible: false,
                },
            },
        );

        const rightWall = Matter.Bodies.rectangle(
            width + 15,
            height / 2,
            30,
            height,
            {
                isStatic: true,

                render: {
                    visible: false,
                },
            },
        );

        Matter.Composite.add(world, [
            ground,
            leftWall,
            rightWall,
        ]);

        // =========================
        // 抜かれたブロック
        // =========================

        const pulledBlock = bodies.find(
            ({ index }) => STACK[index].pulled,
        );

        if (pulledBlock) {
            Matter.Body.translate(
                pulledBlock.body,
                {
                    x: Math.min(
                        60,
                        width * 0.12,
                    ),
                    y: 0,
                },
            );

            Matter.Body.setAngularVelocity(
                pulledBlock.body,
                0.02,
            );
        }

        // =========================
        // マウス操作
        // =========================

        const mouse = Matter.Mouse.create(
            canvas,
        );

        const mouseConstraint =
            Matter.MouseConstraint.create(
                engine,
                {
                    mouse,

                    constraint: {
                        stiffness: 0.2,
                        damping: 0.1,

                        render: {
                            visible: false,
                        },
                    },
                },
            );

        Matter.Composite.add(
            world,
            mouseConstraint,
        );

        // =========================
        // Label描画
        // =========================

        const drawLabels = () => {
            bodies.forEach(
                ({
                    body,
                    label,
                    index,
                    width: blockWidth,
                }) => {
                    const { x, y } =
                        body.position;

                    ctx.save();

                    // ブロックの位置へ
                    ctx.translate(x, y);

                    // ブロックの回転に合わせる
                    ctx.rotate(body.angle);

                    // =========================
                    // 行番号
                    // =========================

                    ctx.font = `22px ${FONT_FAMILY}`;

                    ctx.textBaseline = "middle";

                    ctx.fillStyle =
                        "rgba(0, 0, 0, 0.4)";

                    ctx.fillText(
                        String(
                            STACK.length - index,
                        ).padStart(2, "0"),
                        -blockWidth / 2 + 18,
                        0,
                    );

                    // =========================
                    // Label
                    // =========================

                    ctx.fillStyle =
                        "rgba(0, 0, 0, 0.78)";

                    const labelX =
                        -blockWidth / 2 + 60;

                    // 長すぎるlabelだけCanvas内に収める
                    const availableWidth =
                        blockWidth - 76;

                    let displayLabel = label;

                    if (
                        ctx.measureText(label).width >
                        availableWidth
                    ) {
                        let text = "";

                        for (const char of label) {
                            const next = text + char;

                            if (
                                ctx.measureText(next).width >
                                availableWidth - 16
                            ) {
                                break;
                            }

                            text = next;
                        }

                        displayLabel =
                            text.trimEnd() + "...";
                    }

                    ctx.fillText(
                        displayLabel,
                        labelX,
                        0,
                    );

                    ctx.restore();
                },
            );
        };

        const render = Matter.Render.create({
            canvas,
            engine,

            options: {
                width,
                height,
                wireframes: false,
                background: "transparent",
                pixelRatio: window.devicePixelRatio,
            },
        });

        Matter.Events.on(
            render,
            "afterRender",
            drawLabels,
        );

        // =========================
        // Engine開始
        // =========================

        const runner =
            Matter.Runner.create();

        Matter.Runner.run(
            runner,
            engine,
        );

        Matter.Render.run(render);

        // =========================
        // Cleanup
        // =========================

        return () => {
            Matter.Events.off(
                render,
                "afterRender",
                drawLabels,
            );

            Matter.Render.stop(render);
            Matter.Runner.stop(runner);
            Matter.Engine.clear(engine);

            render.canvas.remove();
            render.textures = {};
        };
    }, []);

    return (
        <section
            ref={containerRef}
            aria-label="コードジェンガ"
            className="relative h-[360px] w-full cursor-grab overflow-hidden active:cursor-grabbing"
        />
    );
}