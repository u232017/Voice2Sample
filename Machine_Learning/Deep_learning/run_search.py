from modelo_ml import inicializar_modelo, inicializar_base_datos, encontrar_mejor_sample

def main():
    inicializar_modelo()
    inicializar_base_datos()
    resultado = encontrar_mejor_sample("mi_imitacion.wav")
    print("RESULTADO_FINAL:", resultado)

if __name__ == '__main__':
    main()
