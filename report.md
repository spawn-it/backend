# Rapport intermédiaire

## 1. Introduction 

- Présentation générale du projet
- Problématique à résoudre

## 2. Motivations du choix 

### 2.1 Choix du projet

- Besoins identifiés (facilité de déploiement de serveurs de jeux temporaires)
- Pertinence dans le contexte d'infrastructure cloud moderne

### 2.2 Choix du paradigme déclaratif

- Limitations du paradigme impératif pour la gestion d'infrastructure
- Avantages du paradigme déclaratif dans ce contexte
- Raisons d'utiliser OpenTofu/Terraform plutôt que d'autres solutions alternatives



# 3. Le paradigme déclaratif

Le paradigme déclaratif est une approche de programmation qui se concentre sur le "quoi" plutôt que sur le "comment". Contrairement au paradigme impératif qui spécifie une séquence d'opérations à exécuter, le paradigme déclaratif décrit l'état souhaité d'un système sans spécifier explicitement les étapes pour y parvenir. Le développeur déclare les résultats attendus, et c'est le moteur d'exécution qui détermine comment atteindre ces résultats.

Dans un langage déclaratif, on exprime des relations logiques entre entités plutôt qu'une séquence d'instructions. Le système sous-jacent est responsable de traduire ces déclarations en actions concrètes, en calculant et en exécutant les étapes nécessaires pour atteindre l'état décrit.

Les origines du paradigme déclaratif remontent aux années 1970 avec le développement de langages comme Prolog et SQL. Ces langages ont été conçus pour permettre aux utilisateurs de spécifier ce qu'ils voulaient obtenir sans avoir à détailler comment l'obtenir. Prolog, par exemple, permettait de définir des faits et des règles, puis de poser des questions sur ces définitions, tandis que SQL permettait de demander quelles données correspondent à certains critères sans spécifier comment rechercher ces données.

### Les problèmes qu'il vise à résoudre

Le paradigme déclaratif a émergé comme réponse à plusieurs défis liés à la programmation impérative. Dans un environnement impératif, les développeurs sont souvent obligés de gérer des détails de bas niveau qui ne sont pas directement liés au problème métier qu'ils essayent de résoudre. Les programmes impératifs sont particulièrement difficiles à comprendre et à maintenir, car ils nécessitent de suivre mentalement l'évolution de l'état du programme à chaque étape d'exécution, multipliant ainsi les risques d'erreur d'interprétation. En exposant systématiquement les détails d'implémentation qui pourraient être abstraits, l'approche impérative bloque les développeurs à réfléchir à un niveau conceptuel. C'est encore pire pour les systèmes distribués car la gestion de l'état de manière impérative devient trop complexe. Finalement, la nature fondamentalement séquentielle de la programmation impérative rend difficile le parallélisme, ce qui limite les possibilités d'optimisation des performances sur les architectures multi-cœurs.

### Les raisons de son introduction et avantages

L'introduction du paradigme déclaratif répond à la volonté de séparer clairement la définition de ce qui doit être fait (l'intention) et la manière précise dont cela doit être fait (l'implémentation). Cette séparation permet une abstraction de la complexité, ce qui permet aux développeurs de se concentrer sur les problèmes de domaine plutôt que sur les détails d'implémentation sous-jacents. Cette mise en avant des concepts métier permet une meilleure productivité, car elle réduit la quantité de code à écrire en déléguant les aspects mécaniques à un moteur d'exécution spécialisé. 

Ça améliore aussi la maintenabilité, car les programmes déclaratifs sont généralement plus simples et plus lisibles Un avantage est la capacité des systèmes déclaratifs à optimiser automatiquement l'exécution, sans avoir besoin d'intervention du développeur sur le code source, ce qui permet une amélioration des performances sans augmentation de la complexité du code.

En éliminant le besoin de spécifier chaque étape procédurale, cette approche réduit la possibilité d'erreur et augmente la fiabilité du code. Les  opérations déclaratives sont de nature idempotente : l'application répétée d'une même déclaration produit le même résultat final, éliminant ainsi toute une classe de bugs liés à l'exécution multiple. L'abstraction des détails d'implémentation spécifiques permet une meilleure portabilité, permettant d'exécuter le même code sur différentes plateformes sans modifications majeures.

### Les solutions techniques nécessaires à sa mise en œuvre

Ce paradigme nécessite un moteur d'exécution, qui doit être capable d'interpréter les déclarations abstraites et de déterminer la séquence d'actions concrètes à mener pour atteindre l'état souhaité. Ces moteurs s'appuient sur un système de gestion d'état, chargé de suivre avec précision l'état actuel du système pour identifier les transformations qu'il faut faire pour converger vers l'état cible défini par les déclarations. La résolution des potentiels conflits entre différentes déclarations nécessite l'implémentation d'algorithmes de résolution, capables choisir entre des contraintes parfois contradictoires. Enfin, pour garantir des performances acceptables malgré l'abstraction introduite, ces environnements intègrent des mécanismes d'optimisation qui permettent d'exécuter les déclarations de manière efficace, en identifiant les stratégies d'exécution les plus pertinentes selon le contexte.

### Évolution vers la gestion d'infrastructure-as-code

Une évolution notable du paradigme déclaratif est son application à la gestion d'infrastructure cloud sous forme de code (Infrastructure as Code ou IaC). Cette approche consiste à définir l'infrastructure souhaitée sous forme de fichiers de configuration plutôt que de configurer manuellement des serveurs et des services.

Les outils d'IaC comme Terraform, OpenTofu, CloudFormation d'AWS, ou ARM Templates d'Azure, permettent de décrire l'infrastructure souhaitée de manière déclarative. Le système sous-jacent se charge ensuite de créer, modifier ou supprimer les ressources nécessaires pour atteindre cet état.

### Exemples d'applications et langages déclaratifs

Le paradigme déclaratif se retrouve dans de nombreux domaines et langages :

1. **Bases de données** : SQL est probablement l'exemple le plus connu de langage déclaratif, permettant de spécifier quelles données on souhaite obtenir sans préciser comment les obtenir.
2. **Web** : HTML et CSS sont des langages déclaratifs qui décrivent respectivement la structure et l'apparence d'une page web.
3. **Build systems** : Des outils comme Make ou Gradle utilisent des approches déclaratives pour décrire les dépendances entre fichiers et les règles de compilation.
4. **Configuration** : YAML et JSON sont souvent utilisés comme formats déclaratifs pour configurer des applications.
5. **Infrastructure** : Terraform, Kubernetes (manifestes), CloudFormation sont des exemples d'outils déclaratifs pour la gestion d'infrastructure.
6. **Interface utilisateur** : React avec JSX, SwiftUI, ou Flutter utilisent des approches déclaratives pour la construction d'interfaces.
7. **Validation** : Des schémas JSON ou XML permettent de décrire de manière déclarative la structure attendue des données.

### Forces du paradigme pour la gestion d'infrastructure

Quand on parle de gérer des infrastructures, le paradigme déclaratif montre ses points forts car il excelle en matière de reproductibilité - en définissant exactement l'état que nous voulons, on peut recréer le même environnement encore et encore. C'est un peu comme avoir une recette précise qui donne toujours le même gâteau, peu importe qui la suit.

La gestion des versions devient aussi beaucoup plus simple. Nous traitons nos configurations d'infrastructure exactement comme du code source classique - nous pouvons les stocker dans Git, faire des revues de code, et suivre l'historique des changements. Fini le temps où personne ne savait qui avait modifié quoi sur le serveur. L'automatisation est un autre avantage majeur. Une fois que nous avons défini notre infrastructure, nous pouvons laisser les outils s'occuper du déploiement, ce qui réduit considérablement les erreurs humaines.

Un aspect souvent sous-estimé est que notre code déclaratif sert aussi de documentation. Quand un nouveau membre rejoint l'équipe, il n'a qu'à regarder les fichiers de configuration pour comprendre comment l'infrastructure est organisée. Le code devient la source de vérité. Les outils déclaratifs comme Terraform peuvent aussi généralement revenir en arrière facilement. Puisqu'ils connaissent l'état précédent du système, ils peuvent calculer comment y retourner, c'est un filet de sécurité rassurant. Enfin, l'audit devient beaucoup plus simple car il suffit de consulter l'historique des modifications de code, comme pour n'importe quel autre projet de développement.

### Limites et défis

La première difficulté que rencontrent beaucoup de développeurs est la courbe d'apprentissage. Passer d'une pensée impérative à une pensée déclarative peut être difficile et demande un temps d'adaptation.

Le débogage peut aussi devenir plus complexe. Quand quelque chose ne fonctionne pas comme prévu, il est parfois difficile de comprendre pourquoi, car nous ne voyons pas directement le flux d'exécution. L'outil fait des choses en coulisses, et nous devons nous fier à ses messages d'erreur, qui ne sont pas toujours très clairs.

Certains problèmes sont tout simplement plus naturels à exprimer de façon impérative. Il est impossible d'exprimer des algorithme complexes de façon purement déclarative. 

L'abstraction que propose le paradigme déclaratif est à double tranchant. D'un côté, elle évite de se préoccuper des détails, mais de l'autre, elle peut masquer des problèmes importants. Par exemple, il est possible de ne pas remarquer qu'une opération particulière est très coûteuse en ressources jusqu'à ce que la facture cloud arrive.

Gérer l'état du système devient particulièrement complexe dans les environnements distribués. Quand plusieurs composants évoluent en parallèle, s'assurer que tout reste cohérent peut devenir un vrai défi, même avec une approche déclarative.

Enfin, question performance, les systèmes déclaratifs peuvent parfois être moins efficaces que des solutions impératives spécifiquement optimisées.

### Cas d'usage appropriés et inappropriés

Le paradigme déclaratif brille particulièrement dans certains domaines. Les bases de données relationnelles et la configuration d'infrastructure cloud sont probablement les exemples les plus évident , c'est d'ailleurs pour ça que des outils comme Terraform ou CloudFormation ont autant de succès. Définir des schémas de base de données, spécifier des interfaces utilisateur ou établir des règles de validation de données sont aussi des cas où l'approche déclarative simplifie grandement le travail.

En revanche, certains domaines restent difficiles à aborder de manière déclarative. Les algorithmes complexes avec de nombreuses conditions et branches sont généralement plus clairs lorsqu'ils sont exprimés de façon impérative. Pour le traitement en temps réel nécessitant un contrôle très précis ou des optimisations de performance de bas niveau, il faut pouvoir garder la main sur chaque étape du processus.

Dans les situations où le contrôle du flux d'exécution est critique, comme dans certains systèmes embarqués, l'approche impérative reste souvent privilégiée. De même, les interactions utilisateur complexes et imprévisibles sont difficiles à modéliser de façon purement déclarative, c'est pourquoi la programmation d'interfaces utilisateur avancées combine souvent les deux paradigmes.



## 4. OpenTofu comme implémentation du paradigme

### 4.1 Présentation de Terraform/OpenTofu

- Historique et contexte (y compris la bifurcation OpenTofu)
- Architecture et principes de fonctionnement
- Écosystème et communauté

### 4.2 Adéquation avec le paradigme déclaratif

- HCL (HashiCorp Configuration Language) comme langage déclaratif
- Cycle de vie des ressources et gestion d'état
- Providers et abstraction des APIs d'infrastructure

### 4.3 Mécanismes spécifiques appliqués au projet

- Gestion des dépendances entre ressources
- Modularité et réutilisation
- Abstraction multicloud

## 5. Cahier des charges prévisionnel

### 5.1 Architecture technique

- Diagramme de l'infrastructure prévue
- Composants logiciels (3 conteneurs : serveur de jeu, backend API, interface web)

### 5.2 Fonctionnalités

- Parcours utilisateur
- Jeux supportés (QuakeJS, Minecraft, CS:GO)
- Interface utilisateur et expérience

### 5.3 Plan d'implémentation

- Étapes de développement prévues
- Répartition des tâches
- Tests et validation
- Livrables attendus pour la démonstration

## 6. Conclusion

- Récapitulatif des points clés
- Défis anticipés
- Perspectives d'évolution du projet

 
