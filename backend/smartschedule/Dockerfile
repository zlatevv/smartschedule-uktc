# Етап 1: Билдване (използваме образ с вече инсталиран Maven)
FROM maven:3.8.5-openjdk-17 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

# Етап 2: Стартиране (използваме лек Java образ)
FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
# Копираме само готовия .jar файл от предишния етап
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]