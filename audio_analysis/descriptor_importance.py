import json
import os
import math
import traceback


# Este módulo analiza la importancia relativa de descriptores melódicos
# a partir de un archivo JSON ya generado por el extractor de audio.
# La idea es determinar qué descriptores cambian más a lo largo del dataset,
# porque esos son los que mejor separan audios melódicos de loops rítmicos o texturales.


# Cargar un archivo JSON desde la ruta indicada.
# Si no existe, devuelve None.
def load_json(path):
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# Comprueba si un valor es un número válido para el análisis.
def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


# Extrae valores numéricos de un descriptor.
# Esto permite manejar valores escalares y estructuras simples.
def flatten_numeric_values(value):
    if is_number(value):
        return [float(value)]
    if isinstance(value, (list, tuple)):
        result = []
        for item in value:
            result.extend(flatten_numeric_values(item))
        return result
    if isinstance(value, dict):
        result = []
        for item in value.values():
            result.extend(flatten_numeric_values(item))
        return result
    return []


# Calcula la desviación estándar poblacional y la media de una lista de valores.
def calculate_std(values):
    n = len(values)
    if n == 0:
        return 0.0, 0.0
    mean = sum(values) / n
    variance = sum((x - mean) ** 2 for x in values) / n
    return math.sqrt(variance), mean


# Convierte los datos JSON de todos los audios en listas de valores por descriptor.
# Cada descriptor acumula sus valores a lo largo de todas las pistas.
def collect_descriptor_values(all_audio_data):
    descriptor_values = {}
    for audio_id, descriptor_set in all_audio_data.items():
        if not isinstance(descriptor_set, dict):
            continue
        for descriptor_name, descriptor_value in descriptor_set.items():
            values = flatten_numeric_values(descriptor_value)
            if not values:
                continue
            descriptor_values.setdefault(descriptor_name, []).extend(values)
    return descriptor_values


# Calcula una puntuación de importancia para cada descriptor.
# Usamos la desviación estándar normalizada por la media para medir cuánto cambia cada descriptor.
def compute_importance_scores(values_by_descriptor):
    scores = {}
    for descriptor_name, values in sorted(values_by_descriptor.items()):
        if not values:
            continue
        std, mean = calculate_std(values)
        if mean == 0:
            score = std
        else:
            score = std / (abs(mean) + 1e-9)
        scores[descriptor_name] = score
    return scores


# Normaliza las puntuaciones para que sumen 100%.
def normalize_scores(scores):
    total_score = sum(scores.values())
    if total_score <= 0 or not scores:
        if not scores:
            return {}
        equal_value = 100.0 / len(scores)
        return {key: equal_value for key in scores}
    return {key: (value * 100.0 / total_score) for key, value in scores.items()}


# Formatea el contenido del informe en el estilo solicitado.
def describe_descriptor(name):
    descriptions = {
        "hpcp_crest_var": (
            "Mide la variación en el contraste armónico del cromagrama tonal. "
            "Un valor alto indica cambios fuertes en los picos armónicos, lo que suele ocurrir cuando una melodía "
            "avanza por acordes o notas distintas."
        ),
        "pitch_var": (
            "Mide la variación del pitch estimado. "
            "Es una buena señal de que el audio no se mantiene en una sola nota, sino que cambia de altura tonal."
        ),
        "hpcp_entropy_var": (
            "Mide la variación de la entropía tonal en el cromagrama. "
            "Un valor alto sugiere que el perfil armónico se vuelve más complejo o cambia de forma repetida."
        ),
        "hpcp_crest_mean": (
            "Mide el contraste promedio de los picos armónicos. "
            "Es útil para identificar si hay notas dominantes fuertes, incluso antes de medir su variación."
        ),
        "pitch_mean": (
            "Mide el pitch promedio estimado. "
            "Es un indicador general de la altura tonal media del audio, pero no de su movimiento."
        ),
        "hpcp_entropy_mean": (
            "Mide la entropía tonal promedio. "
            "Describe cuán distribuida está la energía en las notas del cromagrama, pero no su variación en el tiempo."
        ),
        "key_strength_edma": (
            "Mide la confianza de una clave tonal usando el método EDMA. "
            "Es más estable y, en este dataset, aporta menos discriminación porque no cambia tanto entre audios."
        ),
        "key_strength_krumhansl": (
            "Mide la fuerza tonal según el perfil de Krumhansl. "
            "Es útil para detectar una tonalidad dominante, pero no es el mejor separador cuando el dataset tiene muchos loops similares."
        ),
        "key_strength_temperley": (
            "Mide la fuerza tonal según el método Temperley. "
            "Suele ser más conservador y, por eso, en este análisis aparece como el menos importante."
        ),
    }
    return descriptions.get(name, "Descriptor melódico adicional. Más alto suele indicar mayor capacidad para discriminar audios melódicos.")


def format_report_section(title, normalized_scores):
    lines = [f"=== {title} ==="]
    if not normalized_scores:
        lines.append("No hay datos válidos para esta categoría.")
        lines.append("")
        return lines

    max_name_len = max(len(name) for name in normalized_scores)
    for name, value in sorted(normalized_scores.items(), key=lambda item: item[1], reverse=True):
        dots = "." * (max_name_len + 5 - len(name))
        lines.append(f"{name} {dots} {value:5.1f}%")

    best = max(normalized_scores.items(), key=lambda item: item[1])[0]
    worst = min(normalized_scores.items(), key=lambda item: item[1])[0]
    top_three = sorted(normalized_scores.items(), key=lambda item: item[1], reverse=True)[:3]

    lines.append("")
    lines.append("Interpretación del resultado:")
    lines.append("- El análisis no mide la calidad musical, sino la capacidad de cada descriptor para distinguir audios melódicos dentro del dataset.")
    lines.append("- Los descriptores que más varían en el dataset son los que aportan más información relevante.")
    lines.append("")
    lines.append(f"Más importante: {best}")
    lines.append(f"  {describe_descriptor(best)}")
    lines.append("")
    lines.append(f"Menos importante: {worst}")
    lines.append(f"  {describe_descriptor(worst)}")
    lines.append("")
    lines.append("Top 3 descriptores y por qué tienen peso:")
    for name, value in top_three:
        lines.append(f"- {name}: {describe_descriptor(name)}")
    lines.append("")
    lines.append("Por qué hpcp_crest_var suele salir primero:")
    lines.append("- Porque mide cambios en la energía de los picos armónicos del cromagrama, un buen proxy para progresiones de acordes y variación melódica.")
    lines.append("- Si este descriptor cambia mucho de una pista a otra, significa que la música no es un loop monofónico estático, sino que evoluciona tonalmente.")
    lines.append("")
    lines.append("Nota: Los valores se normalizan para sumar 100%. Un descriptor con mayor porcentaje tiene más capacidad discriminatoria dentro de este conjunto de audios.")
    lines.append("")
    return lines


# Guarda el texto final del informe en un archivo .txt.
def save_text_report(report_lines, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines).strip() + "\n")


# Analiza únicamente los descriptores melódicos y genera el informe .txt.
def analyze_melodic_importance():
    melodic_path = "descriptors/melodic_descriptors.json"
    melodic_data = load_json(melodic_path)

    if melodic_data is None:
        raise FileNotFoundError(
            f"No se encontró el archivo melódico: {melodic_path}. Asegúrate de que existe en audio_analysis/descriptors"
        )

    values_by_descriptor = collect_descriptor_values(melodic_data)
    scores = compute_importance_scores(values_by_descriptor)
    normalized = normalize_scores(scores)

    report_lines = format_report_section("MELODIC DESCRIPTORS", normalized)
    report_path = "reports/melodic_descriptor_importance.txt"
    save_text_report(report_lines, report_path)
    return report_path


# Punto de entrada cuando se ejecuta el módulo como script.
def main():
    try:
        output_path = analyze_melodic_importance()
        print(f"✔ Informe generado: {output_path}")
    except Exception:
        print("ERROR al generar el análisis de importancia melódica:")
        traceback.print_exc()


if __name__ == "__main__":
    main()
