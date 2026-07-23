# Veredito da análise

A amostra **17c7986320e427a1106f3bbed1e122bcb0d9d38611d159c120df11d9689f4ec4** foi classificada preliminarmente como **Trojan**, com nível de risco **critical** e fase atual estimada em **Exfiltração**.

As principais heurísticas observadas nos logs foram: **Atraso deliberado, Transição RW→RX, Manipulação de arquivos, Comunicação de rede, Persistência, Verificação de overhead, Anti-debug, Injeção de código, Detecção de VM**. As APIs com maior relevância analítica foram: **GetProcAddress, Sleep, VirtualProtect, CreateFile, GetTickCount, DeleteFile, WriteFile, ZwQueryInformationProcess, CheckRemoteDebuggerPresent, VirtualAlloc, CreateRemoteThread, RtlQueryPerformanceCounter, RegSetValue, NtDelayExecution, IsDebuggerPresent, NtQueryInformationProcess, WriteProcessMemory, EnumSystemFirmwareTables**.

O módulo de redução manteve **395013** de **33396339** linhas, resultando em uma redução aproximada de **98.8%**. Esse recorte privilegia eventos críticos e contextos vizinhos aos gatilhos heurísticos, especialmente transições de memória e chamadas indicativas de evasão.

## MITRE ATT&CK (TA0005)

Comportamentos compatíveis com **Defense Evasion** são correlacionados automaticamente à tática [TA0005](https://attack.mitre.org/tactics/TA0005/) na interface, com ID e nome da técnica Enterprise conforme a matriz oficial — separando a **categoria da amostra** (Trojan, Backdoor, etc.) das **técnicas de evasão** observadas.

## Recomendação inicial

Revisar o fluxo reduzido em conjunto com o grafo e a linha do tempo para confirmar o ponto exato em que o malware altera seu comportamento, concentrando a investigação nas chamadas sensíveis e nos artefatos produzidos logo após os gatilhos.