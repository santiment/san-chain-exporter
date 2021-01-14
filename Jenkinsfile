@Library('podTemplateLib')

import net.santiment.utils.podTemplates

properties([
  buildDiscarder(
    logRotator(
      artifactDaysToKeepStr: '30',
      artifactNumToKeepStr: '',
      daysToKeepStr: '30',
      numToKeepStr: ''
    )
  )
])

slaveTemplates = new podTemplates()

slaveTemplates.dockerComposeTemplate { label ->
  node(label) {
    container('docker-compose') {
      def scmVars = checkout scm
      def imageName = "erc20-transfers-exporter"

      stage('Run tests') {
        sh "./bin/test.sh"
      }

      stage('Build image') {
        withCredentials([string(credentialsId: 'aws_account_id', variable: 'aws_account_id')]) {
          def awsRegistry = "${env.aws_account_id}.dkr.ecr.eu-central-1.amazonaws.com"

          docker.withRegistry("https://${awsRegistry}", "ecr:eu-central-1:ecr-credentials") {
            sh "docker build \
              -t ${awsRegistry}/${imageName}:${env.BRANCH_NAME} \
              -t ${awsRegistry}/${imageName}:${scmVars.GIT_COMMIT} \
              -f docker/Dockerfile ."
            sh "docker push ${awsRegistry}/${imageName}:${env.BRANCH_NAME}"
            sh "docker push ${awsRegistry}/${imageName}:${scmVars.GIT_COMMIT}"
          }
        }
      }
    }
  }
}
