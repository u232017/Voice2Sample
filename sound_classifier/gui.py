"""Tkinter GUI for the Sound Classifier application."""

import threading
import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk
from typing import Optional


class SoundClassifierGUI:
    """Graphical interface for the sound classification pipeline.

    Provides controls for building the dataset, training models, and
    classifying individual sounds.  All long-running operations are
    executed in background threads to keep the UI responsive.
    """

    MODEL_TYPES = ["random_forest", "svm", "knn", "gradient_boost"]

    def __init__(self, pipeline) -> None:
        """Initialise the GUI and build all widgets.

        Args:
            pipeline: An initialised :class:`SoundClassificationPipeline`.
        """
        self.pipeline = pipeline
        self.root = tk.Tk()
        self.root.title("Sound Classifier")
        self.root.minsize(700, 550)
        self._build_ui()

    # ------------------------------------------------------------------
    # UI construction
    # ------------------------------------------------------------------

    def _build_ui(self) -> None:
        """Create and layout all widgets."""
        # ── Top-level padding frame ──────────────────────────────────
        main_frame = ttk.Frame(self.root, padding=10)
        main_frame.grid(row=0, column=0, sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)

        # ── Configuration section ────────────────────────────────────
        config_lf = ttk.LabelFrame(main_frame, text="Configuration", padding=8)
        config_lf.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 8))
        config_lf.columnconfigure(1, weight=1)

        ttk.Label(config_lf, text="API Key:").grid(row=0, column=0, sticky="w")
        self.api_key_var = tk.StringVar(value=self.pipeline.api_key)
        ttk.Entry(config_lf, textvariable=self.api_key_var, show="*").grid(
            row=0, column=1, sticky="ew", padx=(6, 0)
        )

        ttk.Label(config_lf, text="Sound classes:").grid(
            row=1, column=0, sticky="nw", pady=(6, 0)
        )
        self.classes_text = tk.Text(config_lf, height=3, width=40)
        self.classes_text.insert("1.0", "\n".join(self.pipeline.sound_classes))
        self.classes_text.grid(row=1, column=1, sticky="ew", padx=(6, 0), pady=(6, 0))

        # ── Dataset / Training section ───────────────────────────────
        actions_lf = ttk.LabelFrame(main_frame, text="Actions", padding=8)
        actions_lf.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 8))

        ttk.Button(
            actions_lf, text="Build Dataset", command=self._on_build_dataset
        ).grid(row=0, column=0, padx=(0, 8))

        ttk.Label(actions_lf, text="Model type:").grid(row=0, column=1, padx=(8, 4))
        self.model_type_var = tk.StringVar(value=self.pipeline.model_type)
        ttk.Combobox(
            actions_lf,
            textvariable=self.model_type_var,
            values=self.MODEL_TYPES,
            state="readonly",
            width=18,
        ).grid(row=0, column=2)
        ttk.Button(
            actions_lf, text="Train Model", command=self._on_train_model
        ).grid(row=0, column=3, padx=(8, 0))

        ttk.Button(
            actions_lf, text="Evaluate All Models", command=self._on_evaluate
        ).grid(row=0, column=4, padx=(8, 0))

        # ── Classify section ─────────────────────────────────────────
        classify_lf = ttk.LabelFrame(main_frame, text="Classify Sound", padding=8)
        classify_lf.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(0, 8))
        classify_lf.columnconfigure(1, weight=1)

        ttk.Label(classify_lf, text="Sound ID or file path:").grid(
            row=0, column=0, sticky="w"
        )
        self.sound_input_var = tk.StringVar()
        ttk.Entry(classify_lf, textvariable=self.sound_input_var).grid(
            row=0, column=1, sticky="ew", padx=(6, 6)
        )
        ttk.Button(
            classify_lf, text="Classify", command=self._on_classify
        ).grid(row=0, column=2)

        # ── Results area ─────────────────────────────────────────────
        results_lf = ttk.LabelFrame(main_frame, text="Results", padding=8)
        results_lf.grid(row=3, column=0, columnspan=2, sticky="nsew", pady=(0, 8))
        main_frame.rowconfigure(3, weight=1)
        results_lf.columnconfigure(0, weight=1)
        results_lf.rowconfigure(0, weight=1)

        self.results_text = scrolledtext.ScrolledText(
            results_lf, wrap=tk.WORD, height=12, state="disabled"
        )
        self.results_text.grid(row=0, column=0, sticky="nsew")

        # ── Progress bar ─────────────────────────────────────────────
        self.progress = ttk.Progressbar(main_frame, mode="indeterminate")
        self.progress.grid(row=4, column=0, columnspan=2, sticky="ew", pady=(0, 4))

        # ── Status bar ───────────────────────────────────────────────
        self.status_var = tk.StringVar(value="Ready")
        ttk.Label(main_frame, textvariable=self.status_var, relief="sunken").grid(
            row=5, column=0, columnspan=2, sticky="ew"
        )

    # ------------------------------------------------------------------
    # Helper utilities
    # ------------------------------------------------------------------

    def _set_status(self, message: str) -> None:
        """Update the status bar text (thread-safe via after)."""
        self.root.after(0, lambda: self.status_var.set(message))

    def _append_result(self, text: str) -> None:
        """Append *text* to the results widget (thread-safe)."""
        def _do():
            self.results_text.configure(state="normal")
            self.results_text.insert(tk.END, text + "\n")
            self.results_text.see(tk.END)
            self.results_text.configure(state="disabled")
        self.root.after(0, _do)

    def _start_progress(self) -> None:
        self.root.after(0, self.progress.start)

    def _stop_progress(self) -> None:
        self.root.after(0, self.progress.stop)

    def _run_in_thread(self, target, *args) -> None:
        """Execute *target* in a daemon background thread."""
        thread = threading.Thread(target=target, args=args, daemon=True)
        thread.start()

    # ------------------------------------------------------------------
    # Button callbacks
    # ------------------------------------------------------------------

    def _on_build_dataset(self) -> None:
        """Handle the 'Build Dataset' button click."""
        self._run_in_thread(self._build_dataset_task)

    def _build_dataset_task(self) -> None:
        self._set_status("Building dataset…")
        self._start_progress()
        try:
            # Update API key from UI
            self.pipeline.freesound_client.api_key = self.api_key_var.get()
            # Update sound classes from UI
            classes_raw = self.classes_text.get("1.0", tk.END).strip()
            self.pipeline.sound_classes = [
                c.strip() for c in classes_raw.splitlines() if c.strip()
            ]
            df = self.pipeline.build_dataset()
            if df is not None:
                self._append_result(
                    f"Dataset built: {len(df)} samples, {df['label'].nunique()} classes."
                )
                self._set_status("Dataset built successfully.")
            else:
                self._append_result("Dataset build failed or returned no data.")
                self._set_status("Dataset build failed.")
        except Exception as exc:
            self._append_result(f"Error building dataset: {exc}")
            self._set_status("Error building dataset.")
        finally:
            self._stop_progress()

    def _on_train_model(self) -> None:
        """Handle the 'Train Model' button click."""
        self._run_in_thread(self._train_model_task)

    def _train_model_task(self) -> None:
        self._set_status("Training model…")
        self._start_progress()
        try:
            self.pipeline.model_type = self.model_type_var.get()
            self.pipeline.classifier.model_type = self.pipeline.model_type
            results = self.pipeline.train()
            if results:
                self._append_result(
                    f"Training complete — {results['model_type']} "
                    f"accuracy: {results['accuracy']:.4f}\n{results['report']}"
                )
                self._set_status(
                    f"Model trained. Accuracy: {results['accuracy']:.4f}"
                )
            else:
                self._append_result("Training failed. Build the dataset first.")
                self._set_status("Training failed.")
        except Exception as exc:
            self._append_result(f"Error training model: {exc}")
            self._set_status("Error training model.")
        finally:
            self._stop_progress()

    def _on_classify(self) -> None:
        """Handle the 'Classify' button click."""
        sound_input = self.sound_input_var.get().strip()
        if not sound_input:
            messagebox.showwarning("Input required", "Enter a sound ID or file path.")
            return
        self._run_in_thread(self._classify_task, sound_input)

    def _classify_task(self, sound_input: str) -> None:
        self._set_status(f"Classifying '{sound_input}'…")
        self._start_progress()
        try:
            result = self.pipeline.classify_sound(sound_input)
            if result:
                lines = [f"Predicted class: {result['class']}"]
                if result.get("probabilities"):
                    lines.append("Probabilities:")
                    for cls, prob in sorted(
                        result["probabilities"].items(),
                        key=lambda kv: kv[1],
                        reverse=True,
                    ):
                        lines.append(f"  {cls}: {prob:.4f}")
                self._append_result("\n".join(lines))
                self._set_status(f"Classification complete: {result['class']}")
            else:
                self._append_result(f"Classification failed for '{sound_input}'.")
                self._set_status("Classification failed.")
        except Exception as exc:
            self._append_result(f"Error classifying sound: {exc}")
            self._set_status("Error classifying sound.")
        finally:
            self._stop_progress()

    def _on_evaluate(self) -> None:
        """Handle the 'Evaluate All Models' button click."""
        self._run_in_thread(self._evaluate_task)

    def _evaluate_task(self) -> None:
        self._set_status("Evaluating all models…")
        self._start_progress()
        try:
            results = self.pipeline.evaluate()
            if results:
                lines = ["Model evaluation results:"]
                for mtype, result in results.items():
                    if "error" in result:
                        lines.append(f"  {mtype}: ERROR — {result['error']}")
                    else:
                        lines.append(
                            f"  {mtype}: accuracy={result['accuracy']:.4f}"
                        )
                self._append_result("\n".join(lines))
                self._set_status("Evaluation complete.")
            else:
                self._append_result("Evaluation failed. Build the dataset first.")
                self._set_status("Evaluation failed.")
        except Exception as exc:
            self._append_result(f"Error during evaluation: {exc}")
            self._set_status("Error during evaluation.")
        finally:
            self._stop_progress()

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    def run(self) -> None:
        """Start the Tkinter event loop."""
        self.root.mainloop()
